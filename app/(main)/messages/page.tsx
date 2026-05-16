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
  const chatEndRef = useRef<HTMLDivElement>(null);
  const listSearchRef = useRef<HTMLInputElement>(null);

  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";

  const { conversations, sendMessage, markRead, setTyping, isTyping, toggleEncryption, forceRefresh, editMessage, deleteMessage, clearChat, saveMessage } =
    useChat(currentUserId, showChat ? activeConvo : null);

  // Load users
  useEffect(() => { api.getUsers().then(setUsers).catch(() => {}); }, []);

  // Initialize active conversation
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

  // Local pending messages
  const [localMsgs, setLocalMsgs] = useState<Record<number, Array<{ id: number; text: string; time: string; createdAt: string }>>>({});

  const selectedConvo = conversations.find(c => c.id === activeConvo) || conversations[0];
  const selectedUser = selectedConvo
    ? (selectedConvo as any).user || users.find(u => u.id === selectedConvo.userId)
    : null;
  const otherUserOnline = selectedConvo ? isOnline(selectedConvo.otherUserLastSeenAt) : false;
  const otherUserTyping = selectedConvo ? isTyping(selectedConvo.id) : false;

  // Filtered conversations
  const filteredConvos = listSearch.trim()
    ? conversations.filter(c => {
        const u = (c as any).user || users.find(u => u.id === c.userId);
        const name = (u?.name || "").toLowerCase();
        const handle = (u?.handle || "").toLowerCase();
        const q = listSearch.toLowerCase();
        return name.includes(q) || handle.includes(q) || c.lastMessage.toLowerCase().includes(q);
      })
    : conversations;

  // Display messages with local pending overlay
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

  // Group messages by date
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

  // Auto-scroll
  const justSentRef = useRef(false);
  useEffect(() => {
    if (!chatEndRef.current) return;
    chatEndRef.current.scrollIntoView({ behavior: justSentRef.current ? "instant" : "smooth" });
    justSentRef.current = false;
  }, [activeConvo, displayMessages.length]);

  // Scroll to search result
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
    const text = editingMsg ? messageInput.trim() : messageInput.trim();

    // Handle edit mode
    if (editingMsg) {
      if (text && text !== editingMsg.text) editMessage(editingMsg.id, text);
      setEditingMsg(null);
      setMessageInput("");
      return;
    }

    // Handle file attachment
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
    // Check if conversation already exists
    const existing = conversations.find(c => c.userId === user.id);
    if (existing) {
      handleSelectConvo(existing.id);
    } else {
      setPendingRecipient(user);
      setActiveConvo(null);
      setShowChat(true);
    }
  };

  // Role gate
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
    <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden bg-white text-[#0a0a0a]">
      {/* Conversation list */}
      <div className={`flex-shrink-0 border-r border-[#f5f5f5] flex flex-col bg-white overflow-hidden shadow-[1px_0_0_rgba(0,0,0,0.02)] ${showChat ? "hidden md:flex md:w-80" : "w-full md:w-80"}`}>
        <div className="px-5 pt-5 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            {showListSearch ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1 flex items-center gap-2 bg-[#f5f5f5] rounded-2xl px-4 py-2.5 ring-1 ring-[#e5e5e5]/50 shadow-inner"
              >
                <Search className="w-4 h-4 text-[#a3a3a3] flex-shrink-0" />
                <input
                  ref={listSearchRef}
                  autoFocus
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  placeholder="Search messages..."
                  className="flex-1 text-[13px] bg-transparent outline-none min-w-0 text-[#0a0a0a] placeholder:text-[#a3a3a3] font-medium"
                />
                <button onClick={() => { setShowListSearch(false); setListSearch(""); }} className="p-1 hover:bg-white rounded-lg transition-colors">
                  <X className="w-3.5 h-3.5 text-[#a3a3a3]" />
                </button>
              </motion.div>
            ) : (
              <>
                <h1 className="text-2xl font-black tracking-tight text-[#0a0a0a]">Messages</h1>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setShowListSearch(true); setTimeout(() => listSearchRef.current?.focus(), 50); }} className="w-10 h-10 flex items-center justify-center hover:bg-[#f5f5f5] rounded-xl transition-all active:scale-90">
                    <Search className="w-4 h-4 text-[#737373]" />
                  </button>
                  <button onClick={() => setShowNewConvo(true)} className="w-8 h-8 flex items-center justify-center bg-[#0a0a0a] hover:bg-[#262626] rounded-lg transition-all shadow-lg shadow-black/5 active:scale-90">
                    <Plus className="w-4 h-4 text-white" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Direct / Social tab switcher — Premium Redesign */}
          <div className="p-1 bg-[#f5f5f5] rounded-2xl flex items-center relative">
            <motion.div 
              className="absolute h-[calc(100%-8px)] bg-white rounded-xl shadow-sm z-0"
              initial={false}
              animate={{ 
                left: activeTab === "direct" ? "4px" : "calc(50% + 2px)",
                width: "calc(50% - 6px)"
              }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
            <button
              onClick={() => setActiveTab("direct")}
              className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-colors relative z-10 ${
                activeTab === "direct" ? "text-[#0a0a0a]" : "text-[#a3a3a3] hover:text-[#737373]"
              }`}
            >
              Direct
            </button>
            <button
              onClick={() => setActiveTab("social")}
              className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-colors relative z-10 ${
                activeTab === "social" ? "text-[#0a0a0a]" : "text-[#a3a3a3] hover:text-[#737373]"
              }`}
            >
              Social
            </button>
          </div>
        </div>

        {/* Thread list — Direct or Social */}
        <div className="flex-1 overflow-hidden min-h-0">
          {activeTab === "direct" && (
            <div className="h-full overflow-y-auto">
              {filteredConvos.length === 0 && (
                <div className="px-4 py-12 text-center">
                  <p className="text-sm text-[#a3a3a3]">{listSearch ? "No results" : "No conversations yet"}</p>
                  {!listSearch && (
                    <button onClick={() => setShowNewConvo(true)} className="mt-2 text-sm text-[#F44444] font-medium hover:underline">
                      Start a conversation
                    </button>
                  )}
                </div>
              )}
              {filteredConvos.map(convo => {
                const convoUser = (convo as any).user || users.find(u => u.id === convo.userId);
                if (!convoUser) return null;
                const convoOnline = isOnline(convo.otherUserLastSeenAt);
                const convoTyping = isTyping(convo.id);
                return (
                  <button key={convo.id} onClick={() => handleSelectConvo(convo.id)} className={`w-full flex items-center gap-2.5 md:gap-3 px-3 md:px-4 py-2.5 md:py-3 transition-colors text-left ${convo.id === activeConvo ? "bg-[#f5f5f5]" : "hover:bg-[#fafafa]"}`}>
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 md:w-11 md:h-11 rounded-full overflow-hidden ring-1 ring-[#e5e5e5]">
                        {convoUser.avatar ? (
                          <Image src={convoUser.avatar} alt={convoUser.name} width={44} height={44} className="object-cover w-full h-full" />
                        ) : (
                          <div className="w-full h-full bg-[#f5f5f5] flex items-center justify-center">
                            <span className="text-sm font-medium text-[#737373]">{convoUser.name.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                      {convoOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#22c55e] ring-2 ring-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className={`text-sm truncate ${convo.unreadCount > 0 ? "font-semibold" : "font-medium"} text-[#0a0a0a]`}>{convoUser.name}</span>
                          {convoUser.verified && <VerifiedBadge className="scale-75 flex-shrink-0" />}
                          {convo.encryptionEnabled && <Lock className="w-3 h-3 text-[#22c55e] flex-shrink-0" />}
                        </div>
                        <span className="text-[11px] text-[#a3a3a3] flex-shrink-0 ml-2">{convo.time}</span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        {convoTyping ? (
                          <span className="text-xs text-[#F44444] font-medium">typing...</span>
                        ) : (
                          <span className={`text-xs truncate ${convo.unreadCount > 0 ? "text-[#525252] font-medium" : "text-[#737373]"}`}>{convo.lastMessage}</span>
                        )}
                        {convo.unreadCount > 0 && <span className="w-5 h-5 rounded-full bg-[#F44444] text-white text-[10px] font-semibold flex items-center justify-center flex-shrink-0 ml-2">{convo.unreadCount}</span>}
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

      {/* Chat panel */}
      <div className={`flex-1 flex flex-col bg-[#fafafa] min-w-0 min-h-0 overflow-hidden ${!showChat ? "hidden md:flex" : "flex"}`}>
        {activeTab === "social" && selectedSocialThread ? (
          <SocialThreadView
            thread={selectedSocialThread}
            userId={currentUserId}
            onBack={() => { setShowChat(false); setSelectedSocialThread(null); }}
          />
        ) : activeTab === "social" ? (
          <div className="flex-1 flex items-center justify-center text-[#a3a3a3] text-sm">
            Select a conversation
          </div>
        ) : chatUser && (selectedConvo || pendingRecipient) ? (
          <>
            {/* Chat header */}
            <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-[#e5e5e5] flex-shrink-0 min-w-0">
              <div className="flex items-center gap-3">
                <button onClick={() => { setShowChat(false); setPendingRecipient(null); }} className="md:hidden p-1 hover:bg-[#f5f5f5] rounded-lg -ml-1"><ArrowLeft className="w-5 h-5 text-[#525252]" /></button>
                <div className="relative">
                  <div className="w-11 h-11 rounded-full overflow-hidden ring-1 ring-[#e5e5e5] bg-white">
                    <Image src={chatUser.avatar} alt={chatUser.name} width={44} height={44} className="object-cover w-full h-full" />
                  </div>
                  {chatOnline && <div className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-[#22c55e] ring-2 ring-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[15px] text-[#0a0a0a]">{chatUser.name}</span>
                    {chatUser.verified && <VerifiedBadge className="scale-90" />}
                    {selectedConvo?.encryptionEnabled && <Lock className="w-3 h-3 text-[#22c55e]" />}
                  </div>
                  {otherUserTyping ? (
                    <span className="text-xs text-[#F44444] font-bold">typing...</span>
                  ) : chatOnline ? (
                    <span className="text-xs text-[#22c55e] font-semibold">Online</span>
                  ) : (
                    <span className="text-xs text-[#a3a3a3] font-medium">{formatLastSeen(selectedConvo?.otherUserLastSeenAt || chatUser.lastSeenAt)}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={() => setCallModal({ type: "audio" })} className="p-1.5 md:p-2 rounded-lg hover:bg-[#f5f5f5] transition-colors">
                  <Phone className="w-[16px] h-[16px] md:w-[18px] md:h-[18px] text-[#737373]" />
                </button>
                <button onClick={() => setCallModal({ type: "video" })} className="p-1.5 md:p-2 rounded-lg hover:bg-[#f5f5f5] transition-colors">
                  <Video className="w-[16px] h-[16px] md:w-[18px] md:h-[18px] text-[#737373]" />
                </button>
                {selectedConvo && (
                  <button
                    onClick={() => toggleEncryption(selectedConvo.id)}
                    className={`p-1.5 md:p-2 rounded-lg transition-colors ${selectedConvo.encryptionEnabled ? "text-[#22c55e] bg-[#22c55e]/5" : "text-[#a3a3a3] hover:bg-[#f5f5f5]"}`}
                  >
                    {selectedConvo.encryptionEnabled ? <ShieldCheck className="w-[16px] h-[16px] md:w-[18px] md:h-[18px]" /> : <Shield className="w-[16px] h-[16px] md:w-[18px] md:h-[18px]" />}
                  </button>
                )}
                <button onClick={() => setShowChatSearch(v => !v)} className={`p-1.5 md:p-2 rounded-lg transition-colors ${showChatSearch ? "bg-[#f5f5f5]" : "hover:bg-[#f5f5f5]"}`}>
                  <Search className="w-[16px] h-[16px] md:w-[18px] md:h-[18px] text-[#737373]" />
                </button>
                <div className="relative">
                  <button onClick={() => setShowChatMenu(v => !v)} className="p-1.5 md:p-2 rounded-lg hover:bg-[#f5f5f5] transition-colors">
                    <MoreVertical className="w-[16px] h-[16px] md:w-[18px] md:h-[18px] text-[#737373]" />
                  </button>
                  {showChatMenu && selectedConvo && (
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-[#e5e5e5] overflow-hidden z-30 min-w-[140px]" onClick={() => setShowChatMenu(false)}>
                      <button onClick={() => { clearChat(selectedConvo.id); setShowChatMenu(false); }} className="flex items-center gap-2 px-3 py-2.5 hover:bg-[#fafafa] w-full text-left text-[13px] text-[#dc2626]">
                        <Trash2 className="w-3.5 h-3.5" />Clear chat
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
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 md:px-5 py-3 md:py-4 min-w-0">
              {selectedConvo?.encryptionEnabled && (
                <div className="flex justify-center mb-4 md:mb-6">
                  <span className="px-3 py-1 rounded-full bg-[#22c55e]/10 text-[10px] text-[#22c55e] font-medium flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Messages are end-to-end encrypted
                  </span>
                </div>
              )}
              <div className="space-y-1.5 md:space-y-2">
                {pendingRecipient && displayMessages.length === 0 && (
                  <div className="flex justify-center py-12">
                    <p className="text-sm text-[#a3a3a3]">Send a message to start the conversation</p>
                  </div>
                )}
                {groupedMessages.map((group, gi) => (
                  <div key={gi}>
                    {group.label && <DateSeparator label={group.label} />}
                    {group.messages.map((msg: any, idx: number) => {
                      if (msg.deleted) {
                        return (
                          <div key={msg.id} className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}>
                            <div className="px-3.5 py-2 text-[13px] italic text-[#a3a3a3]">This message was deleted</div>
                          </div>
                        );
                      }

                      let storyReply: { type: string; storyImage: string; text: string } | null = null;
                      try { if (msg.text?.startsWith("{")) { const p = JSON.parse(msg.text); if (p.type === "story_reply") storyReply = p; } } catch {}

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
                          initial={isNew ? { opacity: 0, y: 8, scale: 0.97 } : false}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30, mass: 0.8 }}
                          className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                          onContextMenu={(e) => handleContextMenu(e, msg)}
                        >
                          <div className={`${storyReply ? "" : "max-w-[80%] md:max-w-[70%]"} rounded-2xl overflow-hidden transition-all ${
                            isSearchFocus ? "ring-2 ring-[#F44444] ring-offset-2 ring-offset-white" : isSearchMatch ? "ring-1 ring-[#F44444]/30" : ""
                          } ${isMine ? "bg-[#FFF0F0] text-[#0a0a0a] rounded-tr-md shadow-sm" : "bg-white text-[#0a0a0a] rounded-tl-md shadow-[0_1px_2px_rgba(0,0,0,0.06)]"}`}>
                            {storyReply ? (
                              <div className="w-[200px] md:w-[240px]">
                                <div className="relative w-full aspect-[9/16] rounded-t-2xl overflow-hidden bg-black">
                                  <Image src={storyReply.storyImage} alt="Story" fill className="object-cover" />
                                  <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-black/50 to-transparent" />
                                  <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
                                  <span className="absolute top-2.5 left-3 text-[10px] text-white/70 font-bold uppercase tracking-wider">Story Reply</span>
                                </div>
                                <div className="px-3 py-2 text-[13px] md:text-sm flex items-end justify-between gap-2">
                                  <span className="font-medium">{storyReply.text}</span>
                                  <span className="flex items-center gap-1 flex-shrink-0">
                                    <span className="text-[10px] text-[#a3a3a3] font-medium">{timeStr}</span>
                                    {isMine && <MessageStatus status={msg.status || "sent"} />}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="px-4 py-2.5 text-[13px] md:text-sm">
                                {hasAttachment && (
                                  <div className="mb-2">
                                    {msg.attachmentType === "image" && <ImageAttachment url={msg.attachmentUrl} name={msg.attachmentName} />}
                                    {msg.attachmentType === "document" && <DocumentAttachment url={msg.attachmentUrl} name={msg.attachmentName} size={msg.attachmentSize} />}
                                    {msg.attachmentType === "audio" && <AudioAttachment url={msg.attachmentUrl} name={msg.attachmentName} />}
                                  </div>
                                )}
                                {(!hasAttachment || msg.text !== msg.attachmentName) && (
                                  <span className="leading-relaxed">{msg.text}</span>
                                )}
                                <div className="flex items-center justify-end gap-1.5 mt-1 opacity-60">
                                  {msg.edited && <span className="text-[9px] italic font-medium">edited</span>}
                                  <span className="text-[10px] font-semibold">{timeStr}</span>
                                  {isMine && <MessageStatus status={msg.status || "sent"} />}
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

            {/* Edit mode indicator */}
            {editingMsg && (
              <div className="px-3 md:px-4 py-1.5 bg-[#FFF8F0] border-t border-[#f0e0d0] flex items-center justify-between text-xs">
                <span className="text-[#b45309]">Editing message</span>
                <button onClick={() => { setEditingMsg(null); setMessageInput(""); }} className="text-[#a3a3a3] hover:text-[#525252]">Cancel</button>
              </div>
            )}

            {/* Attachment preview */}
            {pendingFile && (
              <AttachmentPreview file={pendingFile.file} type={pendingFile.type} onRemove={() => setPendingFile(null)} />
            )}

            {/* Input */}
            <div className="px-4 py-4 bg-white border-t border-[#e5e5e5] flex items-center gap-3 flex-shrink-0 min-w-0">
              <div className="relative">
                <button onClick={() => setShowAttachPicker(v => !v)} className="p-2 hover:bg-[#f5f5f5] rounded-xl transition-colors">
                  <Paperclip className="w-5 h-5 text-[#737373]" />
                </button>
                <AnimatePresence>
                  {showAttachPicker && <AttachmentPicker onSelect={handleFileSelect} />}
                </AnimatePresence>
              </div>
              <input
                type="text"
                value={messageInput}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSendMessage(); if (e.key === "Escape" && editingMsg) { setEditingMsg(null); setMessageInput(""); } }}
                placeholder={editingMsg ? "Edit message..." : "Type a message..."}
                className="flex-1 bg-[#f5f5f5] rounded-2xl px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-[#F44444]/10 min-w-0"
              />
              <motion.button
                onClick={handleSendMessage}
                disabled={!messageInput.trim() && !pendingFile}
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-all ${uploading ? "bg-[#a3a3a3]" : "bg-[#F44444] hover:bg-[#d64d3c]"}`}
              >
                {uploading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <ArrowUp className="w-5 h-5 text-white" />
                }
              </motion.button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#a3a3a3] text-sm">
            Select a conversation
          </div>
        )}
      </div>

      {/* New conversation modal */}
      {showNewConvo && (
        <NewConversationModal
          currentUserId={currentUserId}
          onSelect={handleNewConvoSelect}
          onClose={() => setShowNewConvo(false)}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <MessageContextMenu
          msg={contextMenu.msg}
          isMine={contextMenu.msg.fromMe}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          currentUserId={currentUserId}
          onEdit={() => { setEditingMsg({ id: contextMenu.msg.id, text: contextMenu.msg.text }); setMessageInput(contextMenu.msg.text); setContextMenu(null); }}
          onDelete={() => { deleteMessage(contextMenu.msg.id); setContextMenu(null); }}
          onSave={() => { saveMessage(contextMenu.msg.id, contextMenu.msg.savedByUser !== currentUserId); setContextMenu(null); }}
          onCopy={() => { navigator.clipboard.writeText(contextMenu.msg.text).catch(() => {}); setContextMenu(null); }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Call modal */}
      {callModal && (
        <CallModal user={chatUser} type={callModal.type} onClose={() => setCallModal(null)} />
      )}
    </div>
  );
}
