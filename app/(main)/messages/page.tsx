"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, useContext } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Send, ArrowLeft, Shield, ShieldCheck, Lock, Plus, Paperclip, Smile, Mic, Square, Trash2, MoreVertical, X, Pause, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { users as fallbackUsers } from "@/app/lib/data";
import { VerifiedBadge } from "@/app/lib/shared-components";
import { AuthContext } from "@/app/lib/contexts";
import { useChat } from "@/app/lib/useChat";
import { api } from "@/app/lib/api";
import { Avatar } from "@/app/components/Avatar";
import {
  formatLastSeen, isOnline, getDateLabel,
  TypingDots, DateSeparator, CircleGate,
  NewConversationModal, ChatSearchBar, EmojiPicker,
  AttachmentPicker, AttachmentPreview, MessageContextMenu,
  MessageBubble, ConversationRow,
  SocialInbox, SocialThreadView, MAX_VIDEO_CLIENT_SIZE,
} from "./components";
import { copyToClipboard } from "@/app/lib/capacitor";
import {
  isVoiceRecordingSupported, unavailableReason,
  acquireMicStream, pickAudioMime, classifyMicError, MIC_GUIDANCE, type MicErrorKind,
} from "@/app/lib/voice";

const CAN_PAUSE_RECORDING =
  typeof window !== "undefined" &&
  typeof window.MediaRecorder !== "undefined" &&
  typeof MediaRecorder.prototype.pause === "function";

const mmss = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// Optimistic (not-yet-confirmed) message held in local state until the server
// row arrives. Covers both text and attachments (with live upload progress).
type PendingMsg = {
  id: number; // negative temp id
  text: string;
  time: string;
  createdAt: string;
  status: "sending" | "failed";
  toUserId: number;
  _confirmedServerId?: number;
  file?: File;
  attachmentType?: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentUrl?: string; // local object URL while uploading
  uploadProgress?: number;
};

// True when a server message confirms an optimistic one — by confirmed server
// id (primary) or a text+time heuristic (fallback before the id is known).
function isConfirmed(p: any, s: any): boolean {
  if (!s.fromMe) return false;
  if (p._confirmedServerId) return s.id === p._confirmedServerId;
  return s.text === p.text &&
    Math.abs(new Date(s.createdAt || 0).getTime() - new Date(p.createdAt).getTime()) < 30_000;
}

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const targetUserId = Number(searchParams.get("user")) || 0;
  const targetConvoId = Number(searchParams.get("c")) || 0;
  const targetMsgId = Number(searchParams.get("msg")) || 0;
  const { currentUserId, userRole } = useContext(AuthContext);
  const [users, setUsers] = useState(fallbackUsers);
  const [activeConvo, setActiveConvo] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearchMatchIds, setChatSearchMatchIds] = useState<number[]>([]);
  const [chatSearchFocusId, setChatSearchFocusId] = useState<number | null>(null);
  const [pendingRecipient, setPendingRecipient] = useState<any>(null);
  const [showAttachPicker, setShowAttachPicker] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; type: string; invalid?: boolean } | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  // Optimistic-send bookkeeping: in-flight upload aborts + object URLs to revoke.
  const uploadControllersRef = useRef<Map<number, AbortController>>(new Map());
  const objectUrlsRef = useRef<Map<number, string>>(new Map());
  const [contextMenu, setContextMenu] = useState<{ msg: any; x: number; y: number } | null>(null);
  const [editingMsg, setEditingMsg] = useState<{ id: number; text: string } | null>(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<"direct" | "social">("direct");
  const [selectedSocialThread, setSelectedSocialThread] = useState<any>(null);
  const [socialFilterPlatform, setSocialFilterPlatform] = useState<string | null>(null);
  const [hasSocialConnections, setHasSocialConnections] = useState<boolean | undefined>(undefined);
  const [convoReady, setConvoReady] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Voice messages — records via MediaRecorder, then reuses the exact same
  // attachment pipeline (upload/preview/send) as a picked audio file.
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordedExtRef = useRef<string>("webm");
  const discardRecordingRef = useRef(false);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Capability detection runs once on the client so the mic is only offered
  // where recording can actually work.
  useEffect(() => { setVoiceSupported(isVoiceRecordingSupported()); }, []);

  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";

  // On desktop (md: and up) the chat pane renders unconditionally alongside
  // the list — the active conversation is on-screen regardless of `showChat`,
  // which only controls which single pane is shown on mobile. Visibility (and
  // therefore what counts as "active" for read-tracking/polling) must reflect
  // that, or a conversation opened via the default/desktop view never gets
  // marked read.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const conversationVisible = activeConvo !== null && (showChat || isDesktop);

  const { conversations, sendMessage, markRead, setTyping, stopTyping, isTyping, toggleEncryption, forceRefresh, editMessage, deleteMessage, clearChat, saveMessage, loadOlderMessages, searchServerConversations, messagesHasMore, loadingOlder } =
    useChat(currentUserId, conversationVisible ? activeConvo : null);

  useEffect(() => { api.getUsers().then(setUsers).catch(() => {}); }, []);

  // Whether the user has connected any social platform at all — used to tell
  // "no conversations yet" (has connections, just nothing new) apart from
  // "nothing connected" (show the connect-a-platform prompt instead).
  useEffect(() => {
    if (!currentUserId) return;
    fetch(`/api/social/connections?userId=${currentUserId}`)
      .then(r => r.ok ? r.json() : { connections: [] })
      .then(d => setHasSocialConnections((d.connections ?? []).some((c: any) => c.active)))
      .catch(() => setHasSocialConnections(undefined));
  }, [currentUserId]);

  useEffect(() => {
    if (conversations.length > 0) { setConvoReady(true); return; }
    if (!currentUserId) return;
    const t = setTimeout(() => setConvoReady(true), 1000);
    return () => clearTimeout(t);
  }, [conversations.length, currentUserId]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('albiz-chat-visibility', { detail: showChat }));
    return () => {
      window.dispatchEvent(new CustomEvent('albiz-chat-visibility', { detail: false }));
    };
  }, [showChat]);

  useEffect(() => {
    if (initialized || !conversations.length) return;
    let opened: number = conversations[0].id;
    // Restore priority: ?c=<conversationId> (refresh) → ?user=<userId> (deep
    // link) → most recent conversation.
    if (targetConvoId && conversations.some((c: any) => c.id === targetConvoId)) {
      opened = targetConvoId;
      setShowChat(true);
    } else if (targetUserId) {
      const targetConvo = conversations.find((c: any) => c.userId === targetUserId);
      if (targetConvo) { opened = targetConvo.id; setShowChat(true); }
    }
    setActiveConvo(opened);
    // Desktop always renders the chat pane for whichever conversation is
    // active, so this default/deep-linked selection is visible immediately —
    // mark it read now rather than waiting on the next poll tick.
    if (isDesktop) markRead(opened);
    setInitialized(true);
  }, [conversations.length, targetUserId, targetConvoId, initialized, isDesktop, markRead]);

  // Keep the URL in sync with the open conversation so a refresh restores it.
  // Uses replaceState (no navigation / re-render) and drops the one-shot ?user=
  // deep-link param once a thread is active.
  useEffect(() => {
    if (!initialized || activeConvo == null || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("c") === String(activeConvo)) return;
    // Moving to a different thread — drop the one-shot deep-link params so a
    // stale ?msg= highlight target doesn't linger on the next conversation.
    url.searchParams.delete("user");
    url.searchParams.delete("msg");
    url.searchParams.set("c", String(activeConvo));
    window.history.replaceState(null, "", url.toString());
  }, [activeConvo, initialized]);

  const [localMsgs, setLocalMsgs] = useState<Record<number, PendingMsg[]>>({});

  const selectedConvo = activeConvo !== null ? conversations.find(c => c.id === activeConvo) : null;
  // Stable access to the active conversation id for memo-safe send/retry handlers.
  const selectedConvoIdRef = useRef<number | null>(null);
  selectedConvoIdRef.current = selectedConvo?.id ?? null;
  const pendingOpenUserIdRef = useRef<number | null>(null);
  // Monotonic, always-negative temp ids for optimistic messages — collision-proof
  // even for sends fired within the same millisecond.
  const tempIdRef = useRef(-1);
  const nextTempId = () => (tempIdRef.current -= 1);
  const selectedUser = selectedConvo
    ? (selectedConvo as any).user || users.find(u => u.id === selectedConvo.userId)
    : null;
  const otherUserOnline = selectedConvo ? isOnline(selectedConvo.otherUserLastSeenAt) : false;
  const otherUserTyping = selectedConvo ? isTyping(selectedConvo.id) : false;

  // Order by most-recent activity so recent threads rise to the top. Uses the
  // newest message time (incl. optimistic sends) and falls back to updatedAt,
  // deliberately NOT reordering on typing/read-only updates.
  const sortedConversations = useMemo(() => {
    const activity = (c: any) => {
      const msgs = c.messages;
      const t1 = msgs?.length ? new Date(msgs[msgs.length - 1].createdAt || 0).getTime() : 0;
      const local = localMsgs[c.id];
      const t2 = local?.length ? new Date(local[local.length - 1].createdAt || 0).getTime() : 0;
      const base = Math.max(t1, t2);
      return base || (c.updatedAt ? new Date(c.updatedAt).getTime() : 0);
    };
    return [...conversations].sort((a, b) => activity(b) - activity(a));
  }, [conversations, localMsgs]);

  // Instant client-side filter over loaded threads (name, handle, preview, and
  // loaded message bodies). Server search merges deeper matches in parallel.
  const filteredConvos = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return sortedConversations;
    return sortedConversations.filter(c => {
      const u = (c as any).user || users.find(uu => uu.id === c.userId);
      if ((u?.name || "").toLowerCase().includes(q)) return true;
      if ((u?.handle || "").toLowerCase().includes(q)) return true;
      if ((c.lastMessage || "").toLowerCase().includes(q)) return true;
      return (c.messages || []).some((m: any) =>
        !m.deleted && !m.encrypted && typeof m.text === "string" && m.text.toLowerCase().includes(q)
      );
    });
  }, [listSearch, sortedConversations, users]);

  // Debounced server-side search augments the local filter with DB matches
  // (message-body text, threads not currently in view) without loading them all.
  useEffect(() => {
    const q = listSearch.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => { searchServerConversations(q); }, 300);
    return () => clearTimeout(t);
  }, [listSearch, searchServerConversations]);

  const selectedConvoId = selectedConvo?.id ?? null;
  const selectedConvoMessages = selectedConvo?.messages;

  // Revoke a pending message's object URL and drop it from the registry.
  const revokePendingUrl = useCallback((tempId: number) => {
    const url = objectUrlsRef.current.get(tempId);
    if (url) { URL.revokeObjectURL(url); objectUrlsRef.current.delete(tempId); }
  }, []);

  // Drop optimistic messages once the server confirms them (in an effect to
  // avoid setState during render), revoking any preview URLs they held.
  useEffect(() => {
    if (!selectedConvoId || !selectedConvoMessages) return;
    const pending = localMsgs[selectedConvoId] || [];
    const unconfirmed = pending.filter(p => !selectedConvoMessages.some(s => isConfirmed(p, s)));
    if (unconfirmed.length < pending.length) {
      for (const p of pending) {
        if (!unconfirmed.includes(p)) revokePendingUrl(p.id);
      }
      setLocalMsgs(prev => ({ ...prev, [selectedConvoId]: unconfirmed }));
    }
  }, [selectedConvoId, selectedConvoMessages, localMsgs, revokePendingUrl]);

  const displayMessages = useMemo(() => {
    if (!selectedConvoId) return [] as any[];
    const serverMsgs = selectedConvoMessages || [];
    const pending = localMsgs[selectedConvoId] || [];
    const unconfirmed = pending.filter(p => !serverMsgs.some(s => isConfirmed(p, s)));
    return [...serverMsgs, ...unconfirmed.map(p => ({
      ...p, fromMe: true,
      status: p.status === "failed" ? "failed" : "sending",
      encrypted: false, iv: null, senderId: currentUserId,
    }))];
  }, [selectedConvoId, selectedConvoMessages, localMsgs, currentUserId]);

  const groupedMessages = useMemo(() => {
    const groups: { label: string; messages: any[] }[] = [];
    let lastLabel = "";
    for (const msg of displayMessages) {
      const label = getDateLabel(msg.createdAt || "");
      if (label && label !== lastLabel) { groups.push({ label, messages: [] }); lastLabel = label; }
      const g = groups[groups.length - 1];
      if (g) g.messages.push(msg);
      else groups.push({ label: "", messages: [msg] });
    }
    return groups;
  }, [displayMessages]);

  const justSentRef = useRef(false);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  // Distance from the bottom captured right before an older page is prepended,
  // so the viewport can be restored to the same messages after layout.
  const olderAnchorRef = useRef<number | null>(null);
  // Jump-to-message (from Saved → Chats): suppress auto-scroll-to-bottom while
  // we locate the bookmarked message, then scroll to + highlight it.
  const highlightPendingRef = useRef(!!targetMsgId);
  const highlightDoneRef = useRef(false);
  const highlightAttemptsRef = useRef(0);

  useLayoutEffect(() => {
    const el = messagesScrollRef.current;
    // Older messages were just prepended — hold the reader's position instead of
    // yanking to the bottom.
    if (olderAnchorRef.current != null && el) {
      el.scrollTop = el.scrollHeight - olderAnchorRef.current;
      olderAnchorRef.current = null;
      return;
    }
    // Resolving a jump target — don't fight it by scrolling to the bottom.
    if (highlightPendingRef.current) return;
    if (!chatEndRef.current) return;
    chatEndRef.current.scrollIntoView({ behavior: justSentRef.current ? "instant" : "smooth" });
    justSentRef.current = false;
  }, [activeConvo, displayMessages.length]);

  // Once the target conversation is open, find the bookmarked message (loading
  // older pages if needed), scroll to it, and flash a highlight. Degrades
  // gracefully if the message is too old or no longer available.
  useEffect(() => {
    if (!targetMsgId || highlightDoneRef.current) return;
    if (!selectedConvo || selectedConvo.id !== activeConvo) return;
    const found = (selectedConvo.messages || []).some((m: any) => m.id === targetMsgId);
    if (found) {
      highlightDoneRef.current = true;
      highlightPendingRef.current = false;
      setChatSearchFocusId(targetMsgId);
      setTimeout(() => setChatSearchFocusId(prev => (prev === targetMsgId ? null : prev)), 3000);
      return;
    }
    if (highlightAttemptsRef.current >= 15 || activeConvo == null || !messagesHasMore[activeConvo]) {
      // Not found within a bounded search — give up and restore normal scrolling.
      highlightDoneRef.current = true;
      highlightPendingRef.current = false;
      return;
    }
    if (!loadingOlder[activeConvo]) {
      highlightAttemptsRef.current += 1;
      loadOlderMessages(activeConvo);
    }
  }, [targetMsgId, selectedConvo, activeConvo, messagesHasMore, loadingOlder, loadOlderMessages]);

  // Infinite scroll: pull older history when the user nears the top.
  const handleMessagesScroll = useCallback(() => {
    const el = messagesScrollRef.current;
    if (!el || activeConvo == null) return;
    if (el.scrollTop <= 80 && messagesHasMore[activeConvo] && !loadingOlder[activeConvo]) {
      olderAnchorRef.current = el.scrollHeight - el.scrollTop;
      loadOlderMessages(activeConvo);
    }
  }, [activeConvo, messagesHasMore, loadingOlder, loadOlderMessages]);

  // Typing lifecycle: clear the recipient-side indicator the moment the user
  // leaves a conversation (server also clears it on send and after the 3s
  // timeout). Only signals when the user was actually typing.
  const typingActiveRef = useRef(false);
  const prevConvoRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevConvoRef.current;
    if (prev != null && prev !== activeConvo && typingActiveRef.current) {
      stopTyping(prev);
      typingActiveRef.current = false;
    }
    prevConvoRef.current = activeConvo;
  }, [activeConvo, stopTyping]);
  useEffect(() => () => {
    if (typingActiveRef.current && prevConvoRef.current != null) stopTyping(prevConvoRef.current);
  }, [stopTyping]);

  useEffect(() => {
    if (chatSearchFocusId) {
      const el = document.getElementById(`msg-${chatSearchFocusId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [chatSearchFocusId]);

  const handleSelectConvo = useCallback((id: number) => {
    pendingOpenUserIdRef.current = null;
    setActiveConvo(id);
    setShowChat(true);
    setPendingRecipient(null);
    setShowChatSearch(false);
    setChatSearchMatchIds([]);
    setChatSearchFocusId(null);
    markRead(id);
  }, [markRead]);

  // --- Optimistic send helpers (stable across renders so memoized bubbles
  //     don't re-render when unrelated state changes) ---

  const patchPending = useCallback((convoId: number, tempId: number, patch: Partial<PendingMsg>) => {
    setLocalMsgs(prev => ({
      ...prev,
      [convoId]: (prev[convoId] || []).map(m => (m.id === tempId ? { ...m, ...patch } : m)),
    }));
  }, []);

  const removePending = useCallback((convoId: number, tempId: number) => {
    revokePendingUrl(tempId);
    setLocalMsgs(prev => ({
      ...prev,
      [convoId]: (prev[convoId] || []).filter(m => m.id !== tempId),
    }));
  }, [revokePendingUrl]);

  const sendTextPending = useCallback((convoId: number, toUserId: number, text: string, tempId: number) => {
    patchPending(convoId, tempId, { status: "sending" });
    sendMessage(toUserId, text)
      .then(result => {
        patchPending(convoId, tempId, result
          ? { _confirmedServerId: result.messageId }
          : { status: "failed" });
      })
      .catch(() => patchPending(convoId, tempId, { status: "failed" }));
  }, [patchPending, sendMessage]);

  const uploadAndSendPending = useCallback(async (convoId: number, tempId: number, pending: PendingMsg) => {
    if (!pending.file) return;
    patchPending(convoId, tempId, { status: "sending", uploadProgress: 0 });
    const controller = new AbortController();
    uploadControllersRef.current.set(tempId, controller);
    try {
      const res = await api.uploadChatFile(pending.file, {
        onProgress: (p) => patchPending(convoId, tempId, { uploadProgress: p }),
        signal: controller.signal,
      });
      if (res.error || !res.url) throw new Error(res.error || "Upload failed");
      const r = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId: pending.toUserId,
          text: pending.text,
          attachmentUrl: res.url,
          attachmentType: pending.attachmentType,
          attachmentName: pending.attachmentName,
          attachmentSize: pending.attachmentSize,
        }),
      });
      if (!r.ok) throw new Error("Send failed");
      const data = await r.json().catch(() => ({}));
      patchPending(convoId, tempId, { uploadProgress: 100, _confirmedServerId: data.messageId });
    } catch (err: any) {
      if (err?.name === "AbortError") removePending(convoId, tempId);
      else patchPending(convoId, tempId, { status: "failed" });
    } finally {
      uploadControllersRef.current.delete(tempId);
    }
  }, [patchPending, removePending]);

  const handleContextMenu = useCallback((e: React.MouseEvent, msg: any) => {
    e.preventDefault();
    if (msg.deleted || msg.id < 0) return;
    setContextMenu({ msg, x: e.clientX, y: e.clientY });
  }, []);

  const handleRetryMessage = useCallback((msg: any) => {
    const convoId = selectedConvoIdRef.current;
    if (convoId == null) return;
    if (msg.file) uploadAndSendPending(convoId, msg.id, msg as PendingMsg);
    else sendTextPending(convoId, msg.toUserId, msg.text, msg.id);
  }, [uploadAndSendPending, sendTextPending]);

  const handleCancelUpload = useCallback((msg: any) => {
    const convoId = selectedConvoIdRef.current;
    uploadControllersRef.current.get(msg.id)?.abort();
    if (convoId != null) removePending(convoId, msg.id);
  }, [removePending]);

  const handleSendMessage = async () => {
    const text = messageInput.trim();
    typingActiveRef.current = false;

    if (editingMsg) {
      if (text && text !== editingMsg.text) editMessage(editingMsg.id, text);
      setEditingMsg(null);
      setMessageInput("");
      return;
    }

    // Attachment: show an optimistic bubble with live progress, then upload+send.
    if (pendingFile) {
      if (pendingFile.invalid) return;
      const toId = pendingRecipient?.id || selectedConvo?.userId;
      const convoId = selectedConvo?.id ?? null;
      const file = pendingFile.file;
      const type = pendingFile.type;
      if (!toId) return;
      setPendingFile(null);
      setMessageInput("");
      setAttachError(null);
      justSentRef.current = true;

      if (convoId == null) {
        // Brand-new conversation: no local thread to attach an optimistic bubble
        // to yet — upload+send directly, then auto-open the thread once it lands.
        pendingOpenUserIdRef.current = toId;
        setPendingRecipient(null);
        try {
          const res = await api.uploadChatFile(file);
          if (res.error || !res.url) throw new Error("Upload failed");
          await fetch("/api/conversations", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toUserId: toId, text, attachmentUrl: res.url, attachmentType: type, attachmentName: file.name, attachmentSize: file.size }),
          });
          forceRefresh();
        } catch { /* surfaced when the thread opens with no new message */ }
        return;
      }

      const tempId = nextTempId();
      const localUrl = (type === "image" || type === "video" || type === "audio") ? URL.createObjectURL(file) : undefined;
      if (localUrl) objectUrlsRef.current.set(tempId, localUrl);
      const pending: PendingMsg = {
        id: tempId, text,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        createdAt: new Date().toISOString(), status: "sending", toUserId: toId,
        file, attachmentType: type, attachmentName: file.name, attachmentSize: file.size,
        attachmentUrl: localUrl, uploadProgress: 0,
      };
      setLocalMsgs(prev => ({ ...prev, [convoId]: [...(prev[convoId] || []), pending] }));
      uploadAndSendPending(convoId, tempId, pending);
      return;
    }

    if (!text) return;
    setMessageInput("");
    justSentRef.current = true;

    // Brand-new conversation: create it via the first message, then auto-open.
    if (pendingRecipient && !selectedConvo) {
      const toId = pendingRecipient.id;
      pendingOpenUserIdRef.current = toId;
      sendMessage(toId, text);
      setPendingRecipient(null);
      forceRefresh();
      return;
    }
    if (!selectedConvo) return;

    const tempId = nextTempId();
    const convoId = selectedConvo.id;
    const pending: PendingMsg = {
      id: tempId, text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      createdAt: new Date().toISOString(), status: "sending", toUserId: selectedConvo.userId,
    };
    setLocalMsgs(prev => ({ ...prev, [convoId]: [...(prev[convoId] || []), pending] }));
    sendTextPending(convoId, selectedConvo.userId, text, tempId);
  };

  const handleInputChange = (val: string) => {
    setMessageInput(val);
    if (val.trim() && selectedConvo) {
      setTyping(selectedConvo.id);
      typingActiveRef.current = true;
    }
  };

  // Auto-open a freshly-created conversation once the poll surfaces it.
  useEffect(() => {
    const uid = pendingOpenUserIdRef.current;
    if (uid == null) return;
    const convo = conversations.find((c: any) => c.userId === uid);
    if (convo) {
      pendingOpenUserIdRef.current = null;
      setActiveConvo(convo.id);
      setShowChat(true);
      markRead(convo.id);
    }
  }, [conversations, markRead]);

  // Revoke object URLs and abort in-flight uploads on unmount.
  useEffect(() => {
    const urls = objectUrlsRef.current;
    const controllers = uploadControllersRef.current;
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
      for (const c of controllers.values()) c.abort();
      controllers.clear();
    };
  }, []);

  const handleFileSelect = (file: File, type: string) => {
    setShowAttachPicker(false);
    const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB for non-video
    if (type === "video" && file.size > MAX_VIDEO_CLIENT_SIZE) {
      setPendingFile({ file, type, invalid: true });
      setAttachError(`Video too large. Maximum size is ${Math.round(MAX_VIDEO_CLIENT_SIZE / (1024 * 1024))}MB.`);
      return;
    }
    if (type !== "video" && file.size > MAX_ATTACHMENT_SIZE) {
      setPendingFile({ file, type, invalid: true });
      setAttachError(`File too large. Maximum size is ${Math.round(MAX_ATTACHMENT_SIZE / (1024 * 1024))}MB.`);
      return;
    }
    setAttachError(null);
    setPendingFile({ file, type });
  };

  const canAttach = !!((pendingRecipient || selectedUser) && (selectedConvo || pendingRecipient));

  const inferAttachmentType = (file: File): string => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "document";
  };

  const handleChatDragOver = (e: React.DragEvent) => {
    if (!canAttach) return;
    e.preventDefault();
    setDragOver(true);
  };

  const handleChatDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!canAttach) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file, inferAttachmentType(file));
  };

  const handleRemoveAttachment = () => {
    setPendingFile(null);
    setAttachError(null);
  };

  const showMicGuidance = (kind: MicErrorKind) => {
    setMicError(MIC_GUIDANCE[kind]);
    setTimeout(() => setMicError(null), 6000);
  };

  const releaseStream = () => {
    const s = mediaStreamRef.current;
    if (s) { s.getTracks().forEach(t => t.stop()); mediaStreamRef.current = null; }
  };

  const startRecording = async () => {
    setMicError(null);

    // Never touch getUserMedia on an unsupported/insecure origin.
    const blocker = unavailableReason();
    if (blocker) { showMicGuidance(blocker); return; }

    // Always attempt getUserMedia — the browser/OS will either grant access
    // silently (if previously allowed), show the permission prompt (if
    // undetermined), or reject (if blocked). We never pre-check-and-bail so
    // that platforms which re-prompt after a dismissal can do so.
    let stream: MediaStream;
    try {
      stream = await acquireMicStream();
    } catch (err) {
      showMicGuidance(await classifyMicError(err));
      return;
    }

    try {
      const chosen = pickAudioMime();
      recordedExtRef.current = chosen.ext;
      const recorder = chosen.mimeType
        ? new MediaRecorder(stream, { mimeType: chosen.mimeType })
        : new MediaRecorder(stream);
      recordedChunksRef.current = [];
      discardRecordingRef.current = false;
      mediaStreamRef.current = stream;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        releaseStream();
        if (discardRecordingRef.current || recordedChunksRef.current.length === 0) return;
        const type = recorder.mimeType || chosen.mimeType || "audio/webm";
        const blob = new Blob(recordedChunksRef.current, { type });
        if (blob.size === 0) return;
        const file = new File([blob], `voice-message-${Date.now()}.${recordedExtRef.current}`, { type });
        handleFileSelect(file, "audio");
      };
      recorder.onerror = () => {
        releaseStream();
        if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
        setIsRecording(false);
        setIsPaused(false);
        showMicGuidance("unknown");
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch (err) {
      releaseStream();
      showMicGuidance(await classifyMicError(err));
    }
  };

  const pauseRecording = () => {
    const r = mediaRecorderRef.current;
    if (r && r.state === "recording" && typeof r.pause === "function") {
      try { r.pause(); } catch { return; }
      setIsPaused(true);
      if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    }
  };

  const resumeRecording = () => {
    const r = mediaRecorderRef.current;
    if (r && r.state === "paused" && typeof r.resume === "function") {
      try { r.resume(); } catch { return; }
      setIsPaused(false);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    }
  };

  // discard=true cancels (drops audio); discard=false finishes → preview.
  const stopRecording = (discard: boolean) => {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    discardRecordingRef.current = discard;
    setIsRecording(false);
    setIsPaused(false);
    const r = mediaRecorderRef.current;
    if (r && r.state !== "inactive") {
      try { r.stop(); } catch { releaseStream(); }
    } else {
      releaseStream();
    }
  };

  // Release the mic if the user navigates away mid-recording.
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      const r = mediaRecorderRef.current;
      if (r && r.state !== "inactive") {
        discardRecordingRef.current = true;
        try { r.stop(); } catch {}
      }
      releaseStream();
    };
  }, []);

  const handleNewConvoSelect = (user: any) => {
    setShowNewConvo(false);
    const existing = conversations.find(c => c.userId === user.id);
    if (existing) {
      handleSelectConvo(existing.id);
    } else {
      setPendingRecipient(user);
      setActiveConvo(null);
      setShowChat(true);
    }
  };

  if (!isCircle) {
    return (
      <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden">
        <CircleGate />
      </div>
    );
  }

  const chatUser = pendingRecipient || selectedUser;
  const chatOnline = pendingRecipient ? isOnline(pendingRecipient.lastSeenAt) : otherUserOnline;

  return (
    <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden bg-white">

      {/* ── Conversation list ── */}
      <div className={`flex-shrink-0 border-r border-[#efefef] flex flex-col bg-white overflow-hidden ${showChat ? "hidden md:flex md:w-[380px]" : "w-full md:w-[380px]"}`}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[20px] font-bold text-[#0a0a0a] tracking-tight">Messages</span>
            <button
              onClick={() => setShowNewConvo(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#F44444] hover:bg-[#e03c3c] transition-colors active:scale-95"
            >
              <Plus className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Search */}
          <div className="mt-4 flex items-center gap-2.5 bg-[#f5f5f5] rounded-xl px-4 py-3.5">
            <Search className="w-4 h-4 text-[#b0b0b0] flex-shrink-0" />
            <input
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search conversations..."
              className="flex-1 text-[14px] bg-transparent outline-none text-[#0a0a0a] placeholder:text-[#b0b0b0]"
            />
            {listSearch && (
              <button
                onClick={() => setListSearch("")}
                className="flex-shrink-0 text-[#b0b0b0] hover:text-[#737373] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Tab switcher */}
          <div className="mt-5 flex items-center gap-6 border-b border-[#efefef]">
            <button
              onClick={() => setActiveTab("direct")}
              className={`relative pb-3 text-[14px] font-semibold transition-colors ${
                activeTab === "direct" ? "text-[#0a0a0a]" : "text-[#a3a3a3] hover:text-[#525252]"
              }`}
            >
              Direct
              {activeTab === "direct" && (
                <motion.div layoutId="messagesTabUnderline" className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#F44444] rounded-full" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
              )}
            </button>
            <button
              onClick={() => setActiveTab("social")}
              className={`relative pb-3 text-[14px] font-semibold transition-colors ${
                activeTab === "social" ? "text-[#0a0a0a]" : "text-[#a3a3a3] hover:text-[#525252]"
              }`}
            >
              Social
              {activeTab === "social" && (
                <motion.div layoutId="messagesTabUnderline" className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#F44444] rounded-full" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
              )}
            </button>
          </div>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-hidden min-h-0">
          {activeTab === "direct" && (
            <div className="h-full overflow-y-auto">
              {!convoReady ? (
                <div className="space-y-px">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                      <div className="w-14 h-14 rounded-full bg-[#ebebeb] flex-shrink-0" />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="h-3.5 bg-[#ebebeb] rounded" style={{ width: `${45 + (i % 4) * 12}%` }} />
                        <div className="h-3 bg-[#ebebeb] rounded w-3/4" />
                      </div>
                      <div className="h-3 w-9 bg-[#ebebeb] rounded flex-shrink-0" />
                    </div>
                  ))}
                </div>
              ) : filteredConvos.length === 0 ? (
                <div className="px-6 py-10 flex flex-col items-center gap-2">
                  <p className="text-[13px] text-[#a3a3a3]">
                    {listSearch ? "No results" : "No conversations yet"}
                  </p>
                  {!listSearch && (
                    <button
                      onClick={() => setShowNewConvo(true)}
                      className="text-[13px] text-[#F44444] font-medium hover:underline"
                    >
                      Start a conversation
                    </button>
                  )}
                </div>
              ) : null}

              {filteredConvos.map(convo => {
                const convoUser = (convo as any).user || users.find(u => u.id === convo.userId);
                if (!convoUser) return null;
                return (
                  <ConversationRow
                    key={convo.id}
                    convoId={convo.id}
                    name={convoUser.name}
                    avatar={convoUser.avatar}
                    verified={convoUser.verified}
                    encrypted={convo.encryptionEnabled}
                    lastMessage={convo.lastMessage}
                    time={convo.time}
                    unreadCount={convo.unreadCount}
                    online={isOnline(convo.otherUserLastSeenAt)}
                    typing={isTyping(convo.id)}
                    isActive={convo.id === activeConvo}
                    onSelect={handleSelectConvo}
                  />
                );
              })}
            </div>
          )}

          {activeTab === "social" && (
            <SocialInbox
              userId={currentUserId}
              selectedThreadId={selectedSocialThread?.id ?? null}
              onSelectThread={t => { setSelectedSocialThread(t); setShowChat(true); }}
              filterPlatform={socialFilterPlatform}
              onFilterPlatform={setSocialFilterPlatform}
              hasConnections={hasSocialConnections}
            />
          )}
        </div>
      </div>

      {/* ── Chat panel ── */}
      <div
        className={`relative flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-white ${!showChat ? "hidden md:flex" : "flex"}`}
        onDragOver={handleChatDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleChatDrop}
      >
        {dragOver && (
          <div className="absolute inset-0 z-20 bg-[#F44444]/5 border-2 border-dashed border-[#F44444]/40 rounded-none flex items-center justify-center pointer-events-none">
            <span className="px-4 py-2 rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.1)] text-[13px] font-medium text-[#F44444]">
              Drop to attach
            </span>
          </div>
        )}
        {activeTab === "social" && selectedSocialThread ? (
          <SocialThreadView
            thread={selectedSocialThread}
            userId={currentUserId}
            onBack={() => { setShowChat(false); setSelectedSocialThread(null); }}
          />
        ) : activeTab === "social" ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px] text-[#b0b0b0]">
              {hasSocialConnections === false ? "Connect an account to start receiving messages" : "Select a conversation"}
            </p>
          </div>
        ) : chatUser && (selectedConvo || pendingRecipient) ? (
          <>
            {/* Chat header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#efefef] flex-shrink-0 bg-white">
              <div className="flex items-center gap-3.5 min-w-0">
                <button
                  onClick={() => { setShowChat(false); setPendingRecipient(null); }}
                  className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f5f5f5] transition-colors -ml-1 flex-shrink-0"
                >
                  <ArrowLeft className="w-[15px] h-[15px] text-[#525252]" />
                </button>
                <div className="relative flex-shrink-0">
                  <Avatar src={chatUser.avatar} name={chatUser.name} size={48} className="ring-1 ring-black/[0.06]" />
                  {chatOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#22c55e] ring-2 ring-white" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[16px] font-semibold text-[#0a0a0a] truncate">{chatUser.name}</span>
                    {chatUser.verified && <VerifiedBadge className="scale-90 flex-shrink-0" />}
                    {selectedConvo?.encryptionEnabled && <Lock className="w-3 h-3 text-[#22c55e] flex-shrink-0" />}
                  </div>
                  <p className="text-[13px] leading-none mt-1">
                    {otherUserTyping ? (
                      <span className="text-[#F44444] font-medium">typing...</span>
                    ) : chatOnline ? (
                      <span className="text-[#22c55e] font-medium">Online</span>
                    ) : (
                      <span className="text-[#b0b0b0]">{formatLastSeen(selectedConvo?.otherUserLastSeenAt || chatUser.lastSeenAt)}</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {selectedConvo && (
                  <button
                    onClick={() => toggleEncryption(selectedConvo.id)}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
                      selectedConvo.encryptionEnabled ? "text-[#22c55e]" : "text-[#737373] hover:bg-[#f5f5f5]"
                    }`}
                  >
                    {selectedConvo.encryptionEnabled
                      ? <ShieldCheck className="w-[17px] h-[17px]" />
                      : <Shield className="w-[17px] h-[17px]" />
                    }
                  </button>
                )}
                <button
                  onClick={() => setShowChatSearch(v => !v)}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
                    showChatSearch ? "bg-[#f5f5f5] text-[#0a0a0a]" : "hover:bg-[#f5f5f5] text-[#737373]"
                  }`}
                >
                  <Search className="w-[17px] h-[17px]" />
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowChatMenu(v => !v)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#f5f5f5] transition-colors"
                  >
                    <MoreVertical className="w-[17px] h-[17px] text-[#737373]" />
                  </button>
                  {showChatMenu && selectedConvo && (
                    <div
                      className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] border border-[#efefef] overflow-hidden z-30 min-w-[130px]"
                      onClick={() => setShowChatMenu(false)}
                    >
                      <button
                        onClick={() => { clearChat(selectedConvo.id); setShowChatMenu(false); }}
                        className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#fef2f2] w-full text-left text-[13px] text-[#F44444]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear chat
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* In-chat search */}
            {showChatSearch && selectedConvo && (
              <ChatSearchBar
                conversationId={selectedConvo.id}
                onNavigate={(focusId, matchIds) => { setChatSearchFocusId(focusId); setChatSearchMatchIds(matchIds); }}
                onClose={() => { setShowChatSearch(false); setChatSearchMatchIds([]); setChatSearchFocusId(null); }}
              />
            )}

            {/* Messages */}
            <div
              ref={messagesScrollRef}
              onScroll={handleMessagesScroll}
              className="flex-1 overflow-y-auto overflow-x-hidden px-6 md:px-10 py-6 min-w-0 bg-[#fafafa]"
            >
              {activeConvo != null && loadingOlder[activeConvo] && (
                <div className="flex justify-center pb-4">
                  <div className="w-5 h-5 border-2 border-[#efefef] border-t-[#F44444] rounded-full animate-spin" />
                </div>
              )}
              {selectedConvo?.encryptionEnabled && (
                <div className="flex justify-center mb-4">
                  <span className="px-3 py-1 rounded-full bg-[#f0fdf4] text-[10px] text-[#22c55e] font-medium flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> End-to-end encrypted
                  </span>
                </div>
              )}

              {pendingRecipient && displayMessages.length === 0 && (
                <div className="flex justify-center py-12">
                  <p className="text-[13px] text-[#b0b0b0]">Send a message to start the conversation</p>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                {groupedMessages.map((group, gi) => (
                  <div key={gi}>
                    {group.label && <DateSeparator label={group.label} />}
                    {group.messages.map((msg: any, idx: number) => (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        isSearchMatch={chatSearchMatchIds.includes(msg.id)}
                        isSearchFocus={chatSearchFocusId === msg.id}
                        isNew={msg.id < 0 || (gi === groupedMessages.length - 1 && idx === group.messages.length - 1)}
                        onContextMenu={handleContextMenu}
                        onRetry={handleRetryMessage}
                        onCancelUpload={handleCancelUpload}
                      />
                    ))}
                  </div>
                ))}

                <AnimatePresence>
                  {otherUserTyping && <TypingDots />}
                </AnimatePresence>
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Edit indicator */}
            {editingMsg && (
              <div className="px-4 py-2 border-t border-[#efefef] bg-[#fffbf0] flex items-center justify-between">
                <span className="text-[12px] text-[#d97706] font-medium">Editing message</span>
                <button
                  onClick={() => { setEditingMsg(null); setMessageInput(""); }}
                  className="text-[12px] text-[#a3a3a3] hover:text-[#737373] transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Attachment preview (compose stage) */}
            {pendingFile && (
              <AttachmentPreview
                file={pendingFile.file}
                type={pendingFile.type}
                onRemove={handleRemoveAttachment}
                error={attachError}
              />
            )}

            {/* Input bar */}
            <div className="px-6 py-4 border-t border-[#efefef] flex items-center gap-2.5 flex-shrink-0 bg-white">
              {isRecording ? (
                <div className="flex-1 flex items-center gap-3 bg-[#fef2f2] rounded-2xl px-4 py-3">
                  <button onClick={() => stopRecording(true)} aria-label="Cancel recording" className="text-[#a3a3a3] hover:text-[#F44444] transition-colors flex-shrink-0">
                    <Trash2 className="w-[18px] h-[18px]" />
                  </button>
                  <span className="flex items-center gap-2 text-[14px] text-[#F44444] font-medium tabular-nums flex-shrink-0">
                    <span className={`w-2 h-2 rounded-full bg-[#F44444] flex-shrink-0 ${isPaused ? "" : "animate-pulse"}`} />
                    {mmss(recordingSeconds)}
                  </span>
                  <span className="flex-1 text-[12px] text-[#F44444]/60 truncate">{isPaused ? "Paused" : "Recording…"}</span>
                  {CAN_PAUSE_RECORDING && (
                    <button
                      onClick={isPaused ? resumeRecording : pauseRecording}
                      aria-label={isPaused ? "Resume recording" : "Pause recording"}
                      className="text-[#F44444] hover:text-[#e03c3c] transition-colors flex-shrink-0"
                    >
                      {isPaused ? <Play className="w-[18px] h-[18px]" /> : <Pause className="w-[18px] h-[18px]" />}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="relative">
                    <button
                      onClick={() => setShowAttachPicker(v => !v)}
                      className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#f5f5f5] transition-colors"
                    >
                      <Paperclip className="w-[18px] h-[18px] text-[#a3a3a3]" />
                    </button>
                    <AnimatePresence>
                      {showAttachPicker && <AttachmentPicker onSelect={handleFileSelect} />}
                    </AnimatePresence>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setShowEmojiPicker(v => !v)}
                      className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#f5f5f5] transition-colors"
                    >
                      <Smile className="w-[18px] h-[18px] text-[#a3a3a3]" />
                    </button>
                    <AnimatePresence>
                      {showEmojiPicker && (
                        <EmojiPicker
                          onSelect={(emoji) => handleInputChange(messageInput + emoji)}
                          onClose={() => setShowEmojiPicker(false)}
                        />
                      )}
                    </AnimatePresence>
                  </div>

                  <input
                    type="text"
                    value={messageInput}
                    onChange={e => handleInputChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") handleSendMessage();
                      if (e.key === "Escape") {
                        if (editingMsg) { setEditingMsg(null); setMessageInput(""); }
                        else if (pendingFile) handleRemoveAttachment();
                      }
                    }}
                    placeholder={editingMsg ? "Edit message..." : "Message..."}
                    className="flex-1 bg-[#f5f5f5] rounded-2xl px-5 py-3.5 text-[14px] text-[#0a0a0a] placeholder:text-[#b0b0b0] outline-none focus:ring-2 focus:ring-[#F44444]/10 min-w-0"
                  />
                </>
              )}

              <motion.button
                onClick={isRecording ? () => stopRecording(false) : messageInput.trim() || pendingFile ? handleSendMessage : startRecording}
                disabled={!isRecording && !!pendingFile?.invalid}
                whileTap={{ scale: 0.88 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all bg-[#F44444] hover:bg-[#e03c3c]"
              >
                {isRecording ? (
                  <Square className="w-[16px] h-[16px] text-white fill-white" />
                ) : messageInput.trim() || pendingFile ? (
                  <Send className="w-[18px] h-[18px] text-white" />
                ) : (
                  <Mic className={`w-[18px] h-[18px] text-white ${voiceSupported ? "" : "opacity-50"}`} />
                )}
              </motion.button>
            </div>
            {micError && (
              <div className="px-6 pb-3 -mt-1 flex-shrink-0 bg-white">
                <p className="text-[12px] text-[#F44444]">{micError}</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px] text-[#b0b0b0]">Select a conversation</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showNewConvo && (
        <NewConversationModal
          currentUserId={currentUserId}
          onSelect={handleNewConvoSelect}
          onClose={() => setShowNewConvo(false)}
        />
      )}

      {contextMenu && (
        <MessageContextMenu
          msg={contextMenu.msg}
          isMine={contextMenu.msg.fromMe}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          currentUserId={currentUserId}
          onEdit={() => { setEditingMsg({ id: contextMenu.msg.id, text: contextMenu.msg.text }); setMessageInput(contextMenu.msg.text); setContextMenu(null); }}
          onDelete={() => { deleteMessage(contextMenu.msg.id); setContextMenu(null); }}
          onSave={() => { saveMessage(contextMenu.msg.id, contextMenu.msg.savedByUser !== currentUserId); setContextMenu(null); }}
          onCopy={() => { copyToClipboard(contextMenu.msg.text); setContextMenu(null); }}
          onClose={() => setContextMenu(null)}
        />
      )}

    </div>
  );
}
