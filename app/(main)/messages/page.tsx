"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useContext } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Send, ArrowLeft, Shield, ShieldCheck, Lock, Plus, Paperclip, Smile, Mic, Square, Trash2, MoreVertical, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { users as fallbackUsers } from "@/app/lib/data";
import { VerifiedBadge } from "@/app/lib/shared-components";
import { AuthContext } from "@/app/lib/contexts";
import { useChat } from "@/app/lib/useChat";
import { api } from "@/app/lib/api";
import { Avatar } from "@/app/components/Avatar";
import {
  formatMessageTime, formatLastSeen, isOnline, getDateLabel,
  MessageStatus, TypingDots, DateSeparator, CircleGate,
  NewConversationModal, ChatSearchBar, EmojiPicker,
  ImageAttachment, DocumentAttachment, AudioAttachment, VideoAttachment,
  AttachmentPicker, AttachmentPreview, MessageContextMenu,
  SocialInbox, SocialThreadView, MAX_VIDEO_CLIENT_SIZE,
} from "./components";
import { copyToClipboard } from "@/app/lib/capacitor";

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const targetUserId = Number(searchParams.get("user")) || 0;
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
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [attachError, setAttachError] = useState<string | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const [contextMenu, setContextMenu] = useState<{ msg: any; x: number; y: number } | null>(null);
  const [editingMsg, setEditingMsg] = useState<{ id: number; text: string } | null>(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<"direct" | "social">("direct");
  const [selectedSocialThread, setSelectedSocialThread] = useState<any>(null);
  const [socialFilterPlatform, setSocialFilterPlatform] = useState<string | null>(null);
  const [convoReady, setConvoReady] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Voice messages — records via MediaRecorder, then reuses the exact same
  // attachment pipeline (upload/preview/send) as a picked audio file.
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const { conversations, sendMessage, markRead, setTyping, isTyping, toggleEncryption, forceRefresh, editMessage, deleteMessage, clearChat, saveMessage } =
    useChat(currentUserId, conversationVisible ? activeConvo : null);

  useEffect(() => { api.getUsers().then(setUsers).catch(() => {}); }, []);

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
    if (targetUserId) {
      const targetConvo = conversations.find((c: any) => c.userId === targetUserId);
      if (targetConvo) { opened = targetConvo.id; setShowChat(true); }
    }
    setActiveConvo(opened);
    // Desktop always renders the chat pane for whichever conversation is
    // active, so this default/deep-linked selection is visible immediately —
    // mark it read now rather than waiting on the next poll tick.
    if (isDesktop) markRead(opened);
    setInitialized(true);
  }, [conversations.length, targetUserId, initialized, isDesktop, markRead]);

  const [localMsgs, setLocalMsgs] = useState<Record<number, Array<{ id: number; text: string; time: string; createdAt: string }>>>({});

  const selectedConvo = activeConvo !== null ? conversations.find(c => c.id === activeConvo) : null;
  const selectedUser = selectedConvo
    ? (selectedConvo as any).user || users.find(u => u.id === selectedConvo.userId)
    : null;
  const otherUserOnline = selectedConvo ? isOnline(selectedConvo.otherUserLastSeenAt) : false;
  const otherUserTyping = selectedConvo ? isTyping(selectedConvo.id) : false;

  const filteredConvos = listSearch.trim()
    ? conversations.filter(c => {
        const u = (c as any).user || users.find(u => u.id === c.userId);
        const name = (u?.name || "").toLowerCase();
        const handle = (u?.handle || "").toLowerCase();
        const q = listSearch.toLowerCase();
        return name.includes(q) || handle.includes(q) || c.lastMessage.toLowerCase().includes(q);
      })
    : conversations;

  const selectedConvoId = selectedConvo?.id ?? null;
  const selectedConvoMessages = selectedConvo?.messages;

  // Helper: returns true when a server message confirms an optimistic one.
  // Uses confirmed server ID (primary) falling back to text+time (legacy).
  const isConfirmed = (p: any, s: any) => {
    if (!s.fromMe) return false;
    if ((p as any)._confirmedServerId) return s.id === (p as any)._confirmedServerId;
    return s.text === p.text &&
      Math.abs(new Date(s.createdAt || 0).getTime() - new Date(p.createdAt).getTime()) < 30_000;
  };

  // Clean up confirmed pending messages in an effect to avoid setState during render (H-23)
  useEffect(() => {
    if (!selectedConvoId || !selectedConvoMessages) return;
    const pending = localMsgs[selectedConvoId] || [];
    const unconfirmed = pending.filter(p => !selectedConvoMessages.some(s => isConfirmed(p, s)));
    if (unconfirmed.length < pending.length) {
      setLocalMsgs(prev => ({ ...prev, [selectedConvoId]: unconfirmed }));
    }
  }, [selectedConvoId, selectedConvoMessages, localMsgs]);

  const displayMessages = selectedConvo ? (() => {
    const serverMsgs = selectedConvo.messages || [];
    const pending = localMsgs[selectedConvo.id] || [];
    const unconfirmed = pending.filter(p => !serverMsgs.some(s => isConfirmed(p, s)));
    return [...serverMsgs, ...unconfirmed.map(p => ({
      ...p, fromMe: true,
      // Preserve explicit "failed" status; default unresolved to "sending"
      status: (p as any).status === "failed" ? "failed" : "sending",
      encrypted: false, iv: null, senderId: currentUserId,
    }))];
  })() : [];

  const groupedMessages: { label: string; messages: any[] }[] = [];
  let lastDateLabel = "";
  for (const msg of displayMessages) {
    const label = getDateLabel(msg.createdAt || "");
    if (label && label !== lastDateLabel) {
      groupedMessages.push({ label, messages: [] });
      lastDateLabel = label;
    }
    const group = groupedMessages[groupedMessages.length - 1];
    if (group) group.messages.push(msg);
    else groupedMessages.push({ label: "", messages: [msg] });
  }

  const justSentRef = useRef(false);
  useEffect(() => {
    if (!chatEndRef.current) return;
    chatEndRef.current.scrollIntoView({ behavior: justSentRef.current ? "instant" : "smooth" });
    justSentRef.current = false;
  }, [activeConvo, displayMessages.length]);

  useEffect(() => {
    if (chatSearchFocusId) {
      const el = document.getElementById(`msg-${chatSearchFocusId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [chatSearchFocusId]);

  const handleSelectConvo = (id: number) => {
    setActiveConvo(id);
    setShowChat(true);
    setPendingRecipient(null);
    setShowChatSearch(false);
    setChatSearchMatchIds([]);
    setChatSearchFocusId(null);
    markRead(id);
  };

  const handleSendMessage = async () => {
    const text = messageInput.trim();

    if (editingMsg) {
      if (text && text !== editingMsg.text) editMessage(editingMsg.id, text);
      setEditingMsg(null);
      setMessageInput("");
      return;
    }

    if (pendingFile) {
      if (pendingFile.invalid) return;
      setUploading(true);
      setUploadProgress(0);
      setAttachError(null);
      const controller = new AbortController();
      uploadAbortRef.current = controller;
      try {
        const res = await api.uploadChatFile(pendingFile.file, {
          onProgress: setUploadProgress,
          signal: controller.signal,
        });
        if (res.error || !res.url) throw new Error(res.error || "Upload failed");
        const toId = pendingRecipient?.id || selectedConvo?.userId;
        if (toId) {
          await fetch("/api/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              toUserId: toId,
              text: text || pendingFile.file.name,
              attachmentUrl: res.url,
              attachmentType: pendingFile.type,
              attachmentName: pendingFile.file.name,
              attachmentSize: pendingFile.file.size,
            }),
          });
          setTimeout(() => forceRefresh(), 500);
        }
        setPendingFile(null);
        setMessageInput("");
        justSentRef.current = true;
      } catch (err: any) {
        if (err?.name !== "AbortError") setAttachError("Upload failed. Tap send to retry.");
      } finally {
        setUploading(false);
        uploadAbortRef.current = null;
      }
      return;
    }

    if (!text) return;
    setMessageInput("");
    justSentRef.current = true;

    if (pendingRecipient && !selectedConvo) {
      sendMessage(pendingRecipient.id, text);
      setPendingRecipient(null);
      setTimeout(() => forceRefresh(), 500);
      return;
    }
    if (!selectedConvo) return;

    const tempId = -(Date.now());
    const localMsg = {
      id: tempId,
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      createdAt: new Date().toISOString(),
      status: "sending",
    };
    const convoId = selectedConvo.id;
    setLocalMsgs(prev => ({
      ...prev,
      [convoId]: [...(prev[convoId] || []), localMsg],
    }));
    sendMessage(selectedConvo.userId, text).then(result => {
      if (!result) {
        // Network failure — mark as failed so the user can see it didn't send
        setLocalMsgs(prev => ({
          ...prev,
          [convoId]: (prev[convoId] || []).map(m =>
            m.id === tempId ? { ...m, status: "failed" } : m
          ),
        }));
      } else {
        // Success — store the confirmed server ID so mergeConversations can
        // match this optimistic bubble by ID instead of text+time (MSG-06)
        setLocalMsgs(prev => ({
          ...prev,
          [convoId]: (prev[convoId] || []).map(m =>
            m.id === tempId ? { ...m, _confirmedServerId: result.messageId } : m
          ),
        }));
      }
    });
  };

  const handleInputChange = (val: string) => {
    setMessageInput(val);
    if (val.trim() && selectedConvo) setTyping(selectedConvo.id);
  };

  const handleContextMenu = (e: React.MouseEvent, msg: any) => {
    e.preventDefault();
    if (msg.deleted || msg.id < 0) return;
    setContextMenu({ msg, x: e.clientX, y: e.clientY });
  };

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
    if (uploading) uploadAbortRef.current?.abort();
    setPendingFile(null);
    setAttachError(null);
    setUploadProgress(0);
  };

  const startRecording = async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      recordedChunksRef.current = [];
      discardRecordingRef.current = false;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (discardRecordingRef.current || recordedChunksRef.current.length === 0) return;
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        if (blob.size === 0) return;
        const ext = mimeType.includes("webm") ? "webm" : "m4a";
        const file = new File([blob], `voice-message-${Date.now()}.${ext}`, { type: mimeType });
        handleFileSelect(file, "audio");
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      setMicError("Microphone access denied.");
      setTimeout(() => setMicError(null), 3000);
    }
  };

  const stopRecording = (discard: boolean) => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    discardRecordingRef.current = discard;
    setIsRecording(false);
    mediaRecorderRef.current?.stop();
  };

  // Release the mic if the user navigates away mid-recording.
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        discardRecordingRef.current = true;
        mediaRecorderRef.current.stop();
      }
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
                const convoOnline = isOnline(convo.otherUserLastSeenAt);
                const convoTyping = isTyping(convo.id);
                const isActive = convo.id === activeConvo;

                return (
                  <button
                    key={convo.id}
                    onClick={() => handleSelectConvo(convo.id)}
                    className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors border-b border-[#f5f5f5] border-l-2 ${
                      isActive ? "bg-[#fef2f2] border-l-[#F44444]" : "border-l-transparent hover:bg-[#fafafa]"
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <Avatar src={convoUser.avatar} name={convoUser.name} size={56} className="ring-1 ring-black/[0.06]" />
                      {convoOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#22c55e] ring-2 ring-white" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-[15px] truncate ${convo.unreadCount > 0 ? "font-semibold text-[#0a0a0a]" : "font-medium text-[#0a0a0a]"}`}>
                            {convoUser.name}
                          </span>
                          {convoUser.verified && <VerifiedBadge className="scale-90 flex-shrink-0" />}
                          {convo.encryptionEnabled && <Lock className="w-3 h-3 text-[#22c55e] flex-shrink-0" />}
                        </div>
                        <span className="text-[12px] text-[#b0b0b0] flex-shrink-0">{convo.time}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        {convoTyping ? (
                          <span className="text-[13px] text-[#F44444] font-medium">typing...</span>
                        ) : (
                          <span className={`text-[13px] truncate ${convo.unreadCount > 0 ? "text-[#525252] font-medium" : "text-[#a3a3a3]"}`}>
                            {convo.lastMessage}
                          </span>
                        )}
                        {convo.unreadCount > 0 && (
                          <span className="min-w-[22px] h-[22px] px-1 rounded-full bg-[#F44444] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                            {convo.unreadCount > 9 ? "9+" : convo.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
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
            <p className="text-[13px] text-[#b0b0b0]">Select a conversation</p>
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
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 md:px-10 py-6 min-w-0 bg-[#fafafa]">
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
                    {group.messages.map((msg: any, idx: number) => {
                      if (msg.deleted) {
                        return (
                          <div key={msg.id} className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}>
                            <span className="px-3 py-1.5 text-[12px] italic text-[#b0b0b0]">Message deleted</span>
                          </div>
                        );
                      }

                      let storyReply: { type: string; storyImage: string; text: string } | null = null;
                      try {
                        if (msg.text?.startsWith("{")) {
                          const p = JSON.parse(msg.text);
                          if (p.type === "story_reply") storyReply = p;
                        }
                      } catch {}

                      const isMine = msg.fromMe;
                      const timeStr = formatMessageTime(msg.createdAt, msg.time);
                      const isNew = msg.id < 0 || (gi === groupedMessages.length - 1 && idx === group.messages.length - 1);
                      const isSearchMatch = chatSearchMatchIds.includes(msg.id);
                      const isSearchFocus = chatSearchFocusId === msg.id;
                      const hasAttachment = !!msg.attachmentUrl;

                      return (
                        <motion.div
                          key={msg.id}
                          id={`msg-${msg.id}`}
                          initial={isNew ? { opacity: 0, y: 6, scale: 0.98 } : false}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 32, mass: 0.8 }}
                          className={`flex ${isMine ? "justify-end" : "justify-start"} mb-1`}
                          onContextMenu={(e) => handleContextMenu(e, msg)}
                        >
                          <div className={`${storyReply ? "" : "max-w-[75%] md:max-w-[65%]"} rounded-2xl overflow-hidden ${
                            isSearchFocus
                              ? "ring-2 ring-[#F44444] ring-offset-1 ring-offset-white"
                              : isSearchMatch
                              ? "ring-1 ring-[#F44444]/40"
                              : ""
                          } ${isMine
                              ? "bg-[#F44444] text-white rounded-br-[5px]"
                              : "bg-white text-[#0a0a0a] rounded-bl-[5px] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                          }`}>
                            {storyReply ? (
                              <div className="w-[180px] md:w-[220px]">
                                <div className="relative w-full aspect-[9/16] rounded-t-2xl overflow-hidden bg-black">
                                  <Image src={storyReply.storyImage} alt="Story" fill sizes="(max-width: 768px) 180px, 220px" className="object-cover" />
                                  <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />
                                  <span className="absolute top-2.5 left-3 text-[9px] text-white/60 font-semibold uppercase tracking-wider">Story Reply</span>
                                </div>
                                <div className="px-3 py-2 flex items-end justify-between gap-2">
                                  <span className="text-[13px] font-medium leading-snug">{storyReply.text}</span>
                                  <span className={`text-[10px] flex-shrink-0 font-medium ${isMine ? "text-white/60" : "text-[#a3a3a3]"}`}>{timeStr}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="px-4 py-3">
                                {hasAttachment && (
                                  <div className="mb-2">
                                    {msg.attachmentType === "image" && <ImageAttachment url={msg.attachmentUrl} name={msg.attachmentName} />}
                                    {msg.attachmentType === "video" && <VideoAttachment url={msg.attachmentUrl} name={msg.attachmentName} />}
                                    {msg.attachmentType === "document" && <DocumentAttachment url={msg.attachmentUrl} name={msg.attachmentName} size={msg.attachmentSize} />}
                                    {msg.attachmentType === "audio" && <AudioAttachment url={msg.attachmentUrl} name={msg.attachmentName} />}
                                  </div>
                                )}
                                {(!hasAttachment || msg.text !== msg.attachmentName) && (
                                  <p className="text-[14px] md:text-[15px] leading-relaxed">{msg.text}</p>
                                )}
                                <div className={`flex items-center justify-end gap-1 mt-1.5 ${isMine ? "text-white/60" : "text-[#a3a3a3]"}`}>
                                  {msg.edited && <span className="text-[10px] italic">edited</span>}
                                  <span className="text-[11px] font-medium">{timeStr}</span>
                                  {isMine && <MessageStatus status={msg.status || "sent"} light={true} />}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
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

            {/* Attachment preview */}
            {pendingFile && (
              <AttachmentPreview
                file={pendingFile.file}
                type={pendingFile.type}
                onRemove={handleRemoveAttachment}
                uploading={uploading}
                progress={uploadProgress}
                error={attachError}
              />
            )}

            {/* Input bar */}
            <div className="px-6 py-4 border-t border-[#efefef] flex items-center gap-2.5 flex-shrink-0 bg-white">
              {isRecording ? (
                <div className="flex-1 flex items-center gap-3 bg-[#fef2f2] rounded-2xl px-5 py-3.5">
                  <button onClick={() => stopRecording(true)} className="text-[#a3a3a3] hover:text-[#F44444] transition-colors flex-shrink-0">
                    <Trash2 className="w-[18px] h-[18px]" />
                  </button>
                  <span className="flex-1 flex items-center gap-2 text-[14px] text-[#F44444] font-medium tabular-nums">
                    <span className="w-2 h-2 rounded-full bg-[#F44444] animate-pulse flex-shrink-0" />
                    {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:{String(recordingSeconds % 60).padStart(2, "0")}
                  </span>
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
                className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  uploading ? "bg-[#f5f5f5]" : "bg-[#F44444] hover:bg-[#e03c3c]"
                }`}
              >
                {uploading ? (
                  <div className="w-4 h-4 border-[1.5px] border-white/40 border-t-white rounded-full animate-spin" />
                ) : isRecording ? (
                  <Square className="w-[16px] h-[16px] text-white fill-white" />
                ) : messageInput.trim() || pendingFile ? (
                  <Send className="w-[18px] h-[18px] text-white" />
                ) : (
                  <Mic className="w-[18px] h-[18px] text-white" />
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
