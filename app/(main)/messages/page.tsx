"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useContext } from "react";
import { useSearchParams } from "next/navigation";
import { Search, ArrowUp, ArrowLeft, Shield, ShieldCheck, Lock, Plus, Paperclip, Phone, Video, MoreVertical, Trash2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { users as fallbackUsers } from "@/app/lib/data";
import { VerifiedBadge } from "@/app/lib/shared-components";
import { AuthContext } from "@/app/lib/contexts";
import { useChat } from "@/app/lib/useChat";
import { api } from "@/app/lib/api";
import {
  formatMessageTime, formatLastSeen, isOnline, getDateLabel,
  MessageStatus, TypingDots, DateSeparator, CircleGate,
  NewConversationModal, ChatSearchBar,
  ImageAttachment, DocumentAttachment, AudioAttachment,
  AttachmentPicker, AttachmentPreview, MessageContextMenu, CallModal,
  SocialInbox, SocialThreadView,
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
  const [showListSearch, setShowListSearch] = useState(false);
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearchMatchIds, setChatSearchMatchIds] = useState<number[]>([]);
  const [chatSearchFocusId, setChatSearchFocusId] = useState<number | null>(null);
  const [pendingRecipient, setPendingRecipient] = useState<any>(null);
  const [showAttachPicker, setShowAttachPicker] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; type: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ msg: any; x: number; y: number } | null>(null);
  const [editingMsg, setEditingMsg] = useState<{ id: number; text: string } | null>(null);
  const [callModal, setCallModal] = useState<{ type: "audio" | "video" } | null>(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<"direct" | "social">("direct");
  const [selectedSocialThread, setSelectedSocialThread] = useState<any>(null);
  const [socialFilterPlatform, setSocialFilterPlatform] = useState<string | null>(null);
  const [convoReady, setConvoReady] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const listSearchRef = useRef<HTMLInputElement>(null);

  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";

  const { conversations, sendMessage, markRead, setTyping, isTyping, toggleEncryption, forceRefresh, editMessage, deleteMessage, clearChat, saveMessage } =
    useChat(currentUserId, showChat ? activeConvo : null);

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
    if (targetUserId) {
      const targetConvo = conversations.find((c: any) => c.userId === targetUserId);
      if (targetConvo) { setActiveConvo(targetConvo.id); setShowChat(true); }
      else setActiveConvo(conversations[0].id);
    } else {
      setActiveConvo(conversations[0].id);
    }
    setInitialized(true);
  }, [conversations.length, targetUserId, initialized]);

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

  const displayMessages = selectedConvo ? (() => {
    const serverMsgs = selectedConvo.messages || [];
    const pending = localMsgs[selectedConvo.id] || [];
    const unconfirmed = pending.filter(p =>
      !serverMsgs.some(s => s.fromMe && s.text === p.text && Math.abs(new Date(s.createdAt || 0).getTime() - new Date(p.createdAt).getTime()) < 30_000)
    );
    if (unconfirmed.length < pending.length) {
      setLocalMsgs(prev => ({ ...prev, [selectedConvo.id]: unconfirmed }));
    }
    return [...serverMsgs, ...unconfirmed.map(p => ({ ...p, fromMe: true, status: "sending", encrypted: false, iv: null, senderId: currentUserId }))];
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
      setUploading(true);
      try {
        const res = await api.uploadChatFile(pendingFile.file);
        if (res.url) {
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
        }
      } catch {} finally { setUploading(false); }
      setPendingFile(null);
      setMessageInput("");
      justSentRef.current = true;
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

    const localMsg = {
      id: -(Date.now()),
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      createdAt: new Date().toISOString(),
    };
    setLocalMsgs(prev => ({
      ...prev,
      [selectedConvo.id]: [...(prev[selectedConvo.id] || []), localMsg],
    }));
    sendMessage(selectedConvo.userId, text);
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
    setPendingFile({ file, type });
    setShowAttachPicker(false);
  };

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
      <div className={`flex-shrink-0 border-r border-[#efefef] flex flex-col bg-white overflow-hidden ${showChat ? "hidden md:flex md:w-[300px]" : "w-full md:w-[300px]"}`}>

        {/* Header */}
        <div className="px-4 pt-5 pb-3 flex-shrink-0">
          <AnimatePresence mode="wait" initial={false}>
            {showListSearch ? (
              <motion.div
                key="search"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="flex items-center gap-2 bg-[#f5f5f5] rounded-xl px-3 py-2.5"
              >
                <Search className="w-[14px] h-[14px] text-[#b0b0b0] flex-shrink-0" />
                <input
                  ref={listSearchRef}
                  autoFocus
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  placeholder="Search..."
                  className="flex-1 text-[13px] bg-transparent outline-none text-[#0a0a0a] placeholder:text-[#b0b0b0]"
                />
                <button
                  onClick={() => { setShowListSearch(false); setListSearch(""); }}
                  className="flex-shrink-0 text-[#b0b0b0] hover:text-[#737373] transition-colors"
                >
                  <X className="w-[14px] h-[14px]" />
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="header"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="flex items-center justify-between"
              >
                <span className="text-[17px] font-bold text-[#0a0a0a] tracking-tight">Messages</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setShowListSearch(true); setTimeout(() => listSearchRef.current?.focus(), 50); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f5f5f5] transition-colors active:scale-95"
                  >
                    <Search className="w-[15px] h-[15px] text-[#737373]" />
                  </button>
                  <button
                    onClick={() => setShowNewConvo(true)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#F44444] hover:bg-[#e03c3c] transition-colors active:scale-95"
                  >
                    <Plus className="w-[15px] h-[15px] text-white" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tab switcher */}
          <div className="mt-3 p-0.5 bg-[#f5f5f5] rounded-xl flex items-center relative">
            <motion.div
              className="absolute bg-white rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] z-0"
              initial={false}
              animate={{
                left: activeTab === "direct" ? "2px" : "calc(50% + 1px)",
                width: "calc(50% - 3px)",
                height: "calc(100% - 4px)",
                top: "2px",
              }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
            <button
              onClick={() => setActiveTab("direct")}
              className={`relative z-10 flex-1 py-2 text-[12px] font-semibold rounded-[10px] transition-colors ${
                activeTab === "direct" ? "text-[#0a0a0a]" : "text-[#a3a3a3] hover:text-[#525252]"
              }`}
            >
              Direct
            </button>
            <button
              onClick={() => setActiveTab("social")}
              className={`relative z-10 flex-1 py-2 text-[12px] font-semibold rounded-[10px] transition-colors ${
                activeTab === "social" ? "text-[#0a0a0a]" : "text-[#a3a3a3] hover:text-[#525252]"
              }`}
            >
              Social
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
                    <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-[#ebebeb] flex-shrink-0" />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="h-3 bg-[#ebebeb] rounded" style={{ width: `${45 + (i % 4) * 12}%` }} />
                        <div className="h-2.5 bg-[#ebebeb] rounded w-3/4" />
                      </div>
                      <div className="h-2.5 w-8 bg-[#ebebeb] rounded flex-shrink-0" />
                    </div>
                  ))}
                </div>
              ) : filteredConvos.length === 0 ? (
                <div className="px-4 py-10 flex flex-col items-center gap-2">
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
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isActive ? "bg-[#fef2f2]" : "hover:bg-[#fafafa]"
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-black/[0.06]">
                        {convoUser.avatar ? (
                          <Image src={convoUser.avatar} alt={convoUser.name} width={40} height={40} className="object-cover w-full h-full" />
                        ) : (
                          <div className="w-full h-full bg-[#f5f5f5] flex items-center justify-center">
                            <span className="text-[13px] font-semibold text-[#737373]">{convoUser.name.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                      {convoOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#22c55e] ring-[1.5px] ring-white" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className={`text-[13px] truncate ${convo.unreadCount > 0 ? "font-semibold text-[#0a0a0a]" : "font-medium text-[#0a0a0a]"}`}>
                            {convoUser.name}
                          </span>
                          {convoUser.verified && <VerifiedBadge className="scale-75 flex-shrink-0" />}
                          {convo.encryptionEnabled && <Lock className="w-2.5 h-2.5 text-[#22c55e] flex-shrink-0" />}
                        </div>
                        <span className="text-[11px] text-[#b0b0b0] flex-shrink-0">{convo.time}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        {convoTyping ? (
                          <span className="text-[12px] text-[#F44444] font-medium">typing...</span>
                        ) : (
                          <span className={`text-[12px] truncate ${convo.unreadCount > 0 ? "text-[#525252] font-medium" : "text-[#a3a3a3]"}`}>
                            {convo.lastMessage}
                          </span>
                        )}
                        {convo.unreadCount > 0 && (
                          <span className="w-[18px] h-[18px] rounded-full bg-[#F44444] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
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
      <div className={`flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-white ${!showChat ? "hidden md:flex" : "flex"}`}>
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
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#efefef] flex-shrink-0 bg-white">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => { setShowChat(false); setPendingRecipient(null); }}
                  className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f5f5f5] transition-colors -ml-1 flex-shrink-0"
                >
                  <ArrowLeft className="w-[15px] h-[15px] text-[#525252]" />
                </button>
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 rounded-full overflow-hidden ring-1 ring-black/[0.06]">
                    {chatUser.avatar ? (
                      <Image src={chatUser.avatar} alt={chatUser.name} width={36} height={36} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full bg-[#f5f5f5] flex items-center justify-center">
                        <span className="text-[12px] font-semibold text-[#737373]">{chatUser.name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  {chatOnline && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#22c55e] ring-[1.5px] ring-white" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-semibold text-[#0a0a0a] truncate">{chatUser.name}</span>
                    {chatUser.verified && <VerifiedBadge className="scale-75 flex-shrink-0" />}
                    {selectedConvo?.encryptionEnabled && <Lock className="w-2.5 h-2.5 text-[#22c55e] flex-shrink-0" />}
                  </div>
                  <p className="text-[11px] leading-none mt-0.5">
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

              <div className="flex items-center gap-0.5 flex-shrink-0">
                {selectedConvo && (
                  <button
                    onClick={() => toggleEncryption(selectedConvo.id)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                      selectedConvo.encryptionEnabled ? "text-[#22c55e]" : "text-[#737373] hover:bg-[#f5f5f5]"
                    }`}
                  >
                    {selectedConvo.encryptionEnabled
                      ? <ShieldCheck className="w-[15px] h-[15px]" />
                      : <Shield className="w-[15px] h-[15px]" />
                    }
                  </button>
                )}
                <button
                  onClick={() => setShowChatSearch(v => !v)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    showChatSearch ? "bg-[#f5f5f5] text-[#0a0a0a]" : "hover:bg-[#f5f5f5] text-[#737373]"
                  }`}
                >
                  <Search className="w-[15px] h-[15px]" />
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowChatMenu(v => !v)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f5f5f5] transition-colors"
                  >
                    <MoreVertical className="w-[15px] h-[15px] text-[#737373]" />
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
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 min-w-0">
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

              <div className="flex flex-col gap-1">
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
                          className={`flex ${isMine ? "justify-end" : "justify-start"} mb-0.5`}
                          onContextMenu={(e) => handleContextMenu(e, msg)}
                        >
                          <div className={`${storyReply ? "" : "max-w-[72%] md:max-w-[60%]"} rounded-2xl overflow-hidden ${
                            isSearchFocus
                              ? "ring-2 ring-[#F44444] ring-offset-1 ring-offset-white"
                              : isSearchMatch
                              ? "ring-1 ring-[#F44444]/40"
                              : ""
                          } ${isMine
                              ? "bg-[#F44444] text-white rounded-br-[5px]"
                              : "bg-[#f5f5f5] text-[#0a0a0a] rounded-bl-[5px]"
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
                              <div className="px-3.5 py-2.5">
                                {hasAttachment && (
                                  <div className="mb-2">
                                    {msg.attachmentType === "image" && <ImageAttachment url={msg.attachmentUrl} name={msg.attachmentName} />}
                                    {msg.attachmentType === "document" && <DocumentAttachment url={msg.attachmentUrl} name={msg.attachmentName} size={msg.attachmentSize} />}
                                    {msg.attachmentType === "audio" && <AudioAttachment url={msg.attachmentUrl} name={msg.attachmentName} />}
                                  </div>
                                )}
                                {(!hasAttachment || msg.text !== msg.attachmentName) && (
                                  <p className="text-[13px] md:text-[14px] leading-relaxed">{msg.text}</p>
                                )}
                                <div className={`flex items-center justify-end gap-1 mt-1 ${isMine ? "text-white/60" : "text-[#a3a3a3]"}`}>
                                  {msg.edited && <span className="text-[9px] italic">edited</span>}
                                  <span className="text-[10px] font-medium">{timeStr}</span>
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
              <AttachmentPreview file={pendingFile.file} type={pendingFile.type} onRemove={() => setPendingFile(null)} />
            )}

            {/* Input bar */}
            <div className="px-4 py-3 border-t border-[#efefef] flex items-center gap-2 flex-shrink-0 bg-white">
              <div className="relative">
                <button
                  onClick={() => setShowAttachPicker(v => !v)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f5f5f5] transition-colors"
                >
                  <Paperclip className="w-[15px] h-[15px] text-[#a3a3a3]" />
                </button>
                <AnimatePresence>
                  {showAttachPicker && <AttachmentPicker onSelect={handleFileSelect} />}
                </AnimatePresence>
              </div>

              <input
                type="text"
                value={messageInput}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleSendMessage();
                  if (e.key === "Escape" && editingMsg) { setEditingMsg(null); setMessageInput(""); }
                }}
                placeholder={editingMsg ? "Edit message..." : "Message..."}
                className="flex-1 bg-[#f5f5f5] rounded-xl px-4 py-2.5 text-[13px] text-[#0a0a0a] placeholder:text-[#b0b0b0] outline-none focus:ring-2 focus:ring-[#F44444]/10 min-w-0"
              />

              <motion.button
                onClick={handleSendMessage}
                disabled={!messageInput.trim() && !pendingFile}
                whileTap={{ scale: 0.88 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                  messageInput.trim() || pendingFile
                    ? uploading ? "bg-[#f5f5f5]" : "bg-[#F44444] hover:bg-[#e03c3c]"
                    : "bg-[#f5f5f5]"
                }`}
              >
                {uploading
                  ? <div className="w-3.5 h-3.5 border-[1.5px] border-[#a3a3a3] border-t-[#525252] rounded-full animate-spin" />
                  : <ArrowUp className={`w-[15px] h-[15px] transition-colors ${messageInput.trim() || pendingFile ? "text-white" : "text-[#b0b0b0]"}`} />
                }
              </motion.button>
            </div>
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

      {callModal && (
        <CallModal user={chatUser} type={callModal.type} onClose={() => setCallModal(null)} />
      )}
    </div>
  );
}
