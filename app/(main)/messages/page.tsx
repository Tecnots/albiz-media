"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useContext } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Settings, ArrowUp, ArrowLeft, Check, CheckCheck, Shield, ShieldCheck, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { messageTabs, users as fallbackUsers } from "@/app/lib/data";
import { VerifiedBadge } from "@/app/lib/shared-components";
import { AuthContext } from "@/app/lib/contexts";
import { useChat } from "@/app/lib/useChat";
import { api } from "@/app/lib/api";

function formatMessageTime(createdAt: string | undefined, fallbackTime: string): string {
  if (!createdAt) return fallbackTime;
  try {
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return fallbackTime;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return fallbackTime; }
}

function formatLastSeen(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return "Offline";
  try {
    const d = new Date(lastSeenAt);
    const diff = Date.now() - d.getTime();
    if (diff < 30_000) return ""; // online — handled separately
    if (diff < 60_000) return "Last seen just now";
    if (diff < 3600_000) return `Last seen ${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86400_000) return `Last seen ${Math.floor(diff / 3600_000)}h ago`;
    return "Offline";
  } catch { return "Offline"; }
}

function isOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  try { return Date.now() - new Date(lastSeenAt).getTime() < 30_000; } catch { return false; }
}

function MessageStatus({ status }: { status: string }) {
  if (status === "read") return <CheckCheck className="w-3 h-3 text-[#F44444]" />;
  if (status === "delivered") return <CheckCheck className="w-3 h-3 text-[#a3a3a3]" />;
  if (status === "sent") return <Check className="w-3 h-3 text-[#a3a3a3]" />;
  if (status === "sending") return <div className="w-3 h-3 border border-[#d5d5d5] border-t-[#a3a3a3] rounded-full animate-spin" />;
  return null;
}

function TypingDots() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 4 }}
      transition={{ type: "spring", duration: 0.15 }}
      className="flex justify-start"
    >
      <div className="bg-white rounded-2xl rounded-bl-md shadow-[0_1px_2px_rgba(0,0,0,0.06)] px-4 py-3 flex items-center gap-1">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#a3a3a3]"
            style={{
              animation: "typingBounce 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </motion.div>
  );
}

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const targetUserId = Number(searchParams.get("user")) || 0;
  const { currentUserId } = useContext(AuthContext);
  const [users, setUsers] = useState(fallbackUsers);
  const [activeConvo, setActiveConvo] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [messageInput, setMessageInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [showMsgSettings, setShowMsgSettings] = useState(false);
  const msgSettingsRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { conversations, sendMessage, markRead, setTyping, isTyping, toggleEncryption } = useChat(currentUserId, showChat ? activeConvo : null);

  // Close settings dropdown on outside click
  useEffect(() => {
    if (!showMsgSettings) return;
    const close = (e: MouseEvent) => {
      if (msgSettingsRef.current && !msgSettingsRef.current.contains(e.target as Node)) setShowMsgSettings(false);
    };
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [showMsgSettings]);

  // Local pending messages — renders instantly, cleared when server confirms
  const [localMsgs, setLocalMsgs] = useState<Record<number, Array<{ id: number; text: string; time: string; createdAt: string }>>>({});

  // Social inbox state
  const [socialMessages, setSocialMessages] = useState<any[]>([]);
  const [socialUnread, setSocialUnread] = useState(0);
  const [socialLoading, setSocialLoading] = useState(false);
  const [activeSocialMsg, setActiveSocialMsg] = useState<any | null>(null);

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

  const selectedConvo = conversations.find(c => c.id === activeConvo) || conversations[0];
  const selectedUser = selectedConvo ? users.find(u => u.id === selectedConvo.userId) : null;
  const otherUserOnline = selectedConvo ? isOnline(selectedConvo.otherUserLastSeenAt) : false;
  const otherUserTyping = selectedConvo ? isTyping(selectedConvo.id) : false;

  // Overlay local pending messages onto conversation list for instant preview
  const conversationsWithLocal = conversations.map(c => {
    const pending = localMsgs[c.id];
    if (!pending || !pending.length) return c;
    const lastPending = pending[pending.length - 1];
    return { ...c, lastMessage: lastPending.text, time: lastPending.time };
  });
  // Sort: conversations with local pending messages go to top
  const sortedConvos = [...conversationsWithLocal].sort((a, b) => {
    const aPending = (localMsgs[a.id]?.length || 0) > 0 ? 1 : 0;
    const bPending = (localMsgs[b.id]?.length || 0) > 0 ? 1 : 0;
    return bPending - aPending;
  });
  const filteredConvos = activeTab === 1 ? sortedConvos.filter(c => c.unreadCount > 0) : sortedConvos;

  // Social platform tabs map: tab index -> platform key
  const SOCIAL_TABS: Record<number, string> = { 2: "instagram", 3: "messenger", 4: "facebook", 5: "linkedin" };
  const activePlatform = SOCIAL_TABS[activeTab];

  // Load social messages when a social tab is active
  useEffect(() => {
    if (!activePlatform || !currentUserId) return;
    setSocialLoading(true);
    fetch(`/api/social/messages?userId=${currentUserId}&platform=${activePlatform}`)
      .then(r => r.ok ? r.json() : { messages: [], unreadCount: 0 })
      .then(d => { setSocialMessages(d.messages ?? []); setSocialUnread(d.unreadCount ?? 0); })
      .catch(() => {})
      .finally(() => setSocialLoading(false));
  }, [activePlatform, currentUserId]);

  // Merge server messages with local pending for display
  const displayMessages = selectedConvo ? (() => {
    const serverMsgs = selectedConvo.messages || [];
    const pending = localMsgs[selectedConvo.id] || [];
    // Remove local msgs that the server already has (matched by text + recent time)
    const unconfirmed = pending.filter(p =>
      !serverMsgs.some(s => s.fromMe && s.text === p.text && Math.abs(new Date(s.createdAt || 0).getTime() - new Date(p.createdAt).getTime()) < 30_000)
    );
    // Clean up confirmed messages
    if (unconfirmed.length < pending.length) {
      setLocalMsgs(prev => ({ ...prev, [selectedConvo.id]: unconfirmed }));
    }
    return [...serverMsgs, ...unconfirmed.map(p => ({ ...p, fromMe: true, status: "sending", encrypted: false, iv: null, senderId: currentUserId }))];
  })() : [];

  // Auto-scroll: instant on send, smooth on receive
  const justSentRef = useRef(false);
  useEffect(() => {
    if (!chatEndRef.current) return;
    chatEndRef.current.scrollIntoView({ behavior: justSentRef.current ? "instant" : "smooth" });
    justSentRef.current = false;
  }, [activeConvo, displayMessages.length]);

  const handleSelectConvo = (id: number) => {
    setActiveConvo(id);
    setShowChat(true);
    markRead(id);
  };

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConvo) return;
    const text = messageInput.trim();
    setMessageInput("");
    justSentRef.current = true;

    // Add to local pending immediately — this is what makes it instant
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

    // Fire the actual send (hook handles API call)
    sendMessage(selectedConvo.userId, text);
  };

  const handleInputChange = (val: string) => {
    setMessageInput(val);
    if (val.trim() && selectedConvo) {
      setTyping(selectedConvo.id);
    }
  };

  return (
    <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden">
      {/* Conversation list */}
      <div className={`flex-shrink-0 border-r border-[#e5e5e5] flex flex-col bg-white overflow-hidden ${showChat ? "hidden md:flex md:w-80" : "w-full md:w-80"}`}>
        <div className="px-3 md:px-4 pt-3 md:pt-4 pb-2 md:pb-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <h1 className="text-lg md:text-xl font-semibold">Messages</h1>
            <div className="flex items-center gap-0.5 md:gap-1">
              <button className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg"><Search className="w-[18px] h-[18px] md:w-5 md:h-5 text-[#737373]" /></button>
              <div className="relative" ref={msgSettingsRef}>
                <button onClick={() => setShowMsgSettings(v => !v)} className={`p-1.5 md:p-2 rounded-lg transition-colors ${showMsgSettings ? "bg-[#f5f5f5]" : "hover:bg-[#f5f5f5]"}`}>
                  <Settings className="w-[18px] h-[18px] md:w-5 md:h-5 text-[#737373]" />
                </button>
                {showMsgSettings && (() => {
                  const allEncrypted = conversations.length > 0 && conversations.every(c => c.encryptionEnabled);
                  return (
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#f0f0f0] overflow-hidden min-w-[220px] z-50">
                      <div className="px-3 py-2.5 flex items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-[#22c55e]" />
                            <span className="text-[13px] text-[#0a0a0a] font-medium">E2E Encryption</span>
                          </div>
                          <span className="text-[11px] text-[#a3a3a3] ml-6">All conversations</span>
                        </div>
                        <button
                          onClick={() => { conversations.forEach(c => { if (c.encryptionEnabled === allEncrypted) toggleEncryption(c.id); }); }}
                          className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${allEncrypted ? "bg-[#22c55e]" : "bg-[#d5d5d5]"}`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-0.5 transition-all ${allEncrypted ? "left-[18px]" : "left-0.5"}`} />
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
          <div className="flex gap-1 md:gap-1.5 overflow-x-auto pb-1">
            {messageTabs.map((tab, i) => (
              <button key={tab} onClick={() => setActiveTab(i)} className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${i === activeTab ? "bg-[#F44444] text-white" : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"}`}>{tab}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {activePlatform ? (
            /* Social inbox */
            socialLoading ? (
              <div className="flex justify-center pt-12">
                <div className="w-5 h-5 border-2 border-[#e5e5e5] border-t-[#F44444] rounded-full animate-spin" />
              </div>
            ) : socialMessages.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="text-sm font-medium text-[#0a0a0a] mb-1">No messages yet</p>
                <p className="text-xs text-[#a3a3a3]">Connect your account in Settings → Connected Accounts to receive messages here.</p>
              </div>
            ) : (
              socialMessages.map(msg => (
                <button
                  key={msg.id}
                  onClick={() => setActiveSocialMsg(activeSocialMsg?.id === msg.id ? null : msg)}
                  className={`w-full flex items-center gap-2.5 px-3 md:px-4 py-2.5 md:py-3 transition-colors text-left ${activeSocialMsg?.id === msg.id ? "bg-[#f5f5f5]" : "hover:bg-[#fafafa]"}`}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-[#e5e5e5] bg-[#f5f5f5] flex-shrink-0 flex items-center justify-center">
                    {msg.fromAvatarUrl ? (
                      <Image src={msg.fromAvatarUrl} alt={msg.fromHandle ?? ""} width={40} height={40} className="object-cover w-full h-full" />
                    ) : (
                      <span className="text-xs font-semibold text-[#a3a3a3]">{(msg.fromHandle ?? "?").charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm truncate ${!msg.read ? "font-semibold" : "font-medium"} text-[#0a0a0a]`}>{msg.fromHandle ?? msg.platformHandle}</span>
                      <span className="text-[11px] text-[#a3a3a3] flex-shrink-0 ml-2">{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <span className={`text-xs truncate block ${!msg.read ? "text-[#525252] font-medium" : "text-[#737373]"}`}>{msg.text}</span>
                  </div>
                  {!msg.read && <span className="w-2 h-2 rounded-full bg-[#F44444] flex-shrink-0" />}
                </button>
              ))
            )
          ) : (
            /* Regular conversations */
            filteredConvos.map(convo => {
              const convoUser = users.find(u => u.id === convo.userId);
              if (!convoUser) return null;
              const convoOnline = isOnline(convo.otherUserLastSeenAt);
              const convoTyping = isTyping(convo.id);
              return (
                <button key={convo.id} onClick={() => handleSelectConvo(convo.id)} className={`w-full flex items-center gap-2.5 md:gap-3 px-3 md:px-4 py-2.5 md:py-3 transition-colors text-left ${convo.id === activeConvo ? "bg-[#f5f5f5]" : "hover:bg-[#fafafa]"}`}>
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 md:w-11 md:h-11 rounded-full overflow-hidden ring-1 ring-[#e5e5e5]">
                      <Image src={convoUser.avatar} alt={convoUser.name} width={44} height={44} className="object-cover w-full h-full" />
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
            })
          )}
        </div>
      </div>

      {/* Chat panel */}
      <div className={`flex-1 flex flex-col bg-[#fafafa] min-w-0 min-h-0 overflow-hidden ${!showChat && !activeSocialMsg ? "hidden md:flex" : "flex"}`}>
        {/* Social message detail view */}
        {activePlatform && activeSocialMsg ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2.5 px-4 py-3 bg-white border-b border-[#e5e5e5] flex-shrink-0">
              <button onClick={() => setActiveSocialMsg(null)} className="md:hidden p-1 hover:bg-[#f5f5f5] rounded-lg -ml-1">
                <ArrowLeft className="w-[18px] h-[18px] text-[#525252]" />
              </button>
              <div className="w-9 h-9 rounded-full overflow-hidden ring-1 ring-[#e5e5e5] bg-[#f5f5f5] flex-shrink-0 flex items-center justify-center">
                {activeSocialMsg.fromAvatarUrl ? (
                  <Image src={activeSocialMsg.fromAvatarUrl} alt={activeSocialMsg.fromHandle ?? ""} width={36} height={36} className="object-cover w-full h-full" />
                ) : (
                  <span className="text-xs font-semibold text-[#a3a3a3]">{(activeSocialMsg.fromHandle ?? "?").charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0a0a0a]">{activeSocialMsg.fromHandle ?? activeSocialMsg.platformHandle}</p>
                <p className="text-[11px] text-[#a3a3a3] capitalize">{activePlatform}</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="max-w-sm">
                <div className="bg-white rounded-2xl rounded-tl-md shadow-[0_1px_2px_rgba(0,0,0,0.06)] px-4 py-3">
                  <p className="text-sm text-[#0a0a0a] leading-relaxed">{activeSocialMsg.text}</p>
                  {activeSocialMsg.attachmentUrl && (
                    <div className="mt-2 rounded-xl overflow-hidden">
                      <Image src={activeSocialMsg.attachmentUrl} alt="Attachment" width={240} height={160} className="object-cover w-full" />
                    </div>
                  )}
                  <p className="text-[10px] text-[#a3a3a3] mt-1.5">{new Date(activeSocialMsg.createdAt).toLocaleString()}</p>
                </div>
                <p className="text-[10px] text-[#a3a3a3] mt-3 px-1">
                  Replies to {activePlatform} DMs must be sent from the {activePlatform} app.
                </p>
              </div>
            </div>
          </div>
        ) : activePlatform && !activeSocialMsg ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-[#a3a3a3]">Select a message to read</p>
          </div>
        ) : selectedUser && selectedConvo ? (
          <>
            {/* Chat header */}
            <div className="flex items-center justify-between px-3 md:px-5 py-2.5 md:py-3 bg-white border-b border-[#e5e5e5] flex-shrink-0 min-w-0">
              <div className="flex items-center gap-2.5 md:gap-3">
                <button onClick={() => setShowChat(false)} className="md:hidden p-1 hover:bg-[#f5f5f5] rounded-lg -ml-1"><ArrowLeft className="w-[18px] h-[18px] text-[#525252]" /></button>
                <div className="relative">
                  <div className="w-9 h-9 md:w-11 md:h-11 rounded-full overflow-hidden ring-1 ring-[#e5e5e5]">
                    <Image src={selectedUser.avatar} alt={selectedUser.name} width={44} height={44} className="object-cover w-full h-full" />
                  </div>
                  {otherUserOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#22c55e] ring-2 ring-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-[13px] md:text-sm">{selectedUser.name}</span>
                    {selectedUser.verified && <VerifiedBadge className="scale-75 md:scale-90" />}
                    {selectedConvo.encryptionEnabled && <Lock className="w-3 h-3 text-[#22c55e]" />}
                  </div>
                  {otherUserTyping ? (
                    <span className="text-[11px] md:text-xs text-[#F44444] font-medium">typing...</span>
                  ) : otherUserOnline ? (
                    <span className="text-[11px] md:text-xs text-[#22c55e] font-medium">Online</span>
                  ) : (
                    <span className="text-[11px] md:text-xs text-[#a3a3a3]">{formatLastSeen(selectedConvo.otherUserLastSeenAt)}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleEncryption(selectedConvo.id)}
                  className={`p-1.5 md:p-2 rounded-lg transition-colors ${selectedConvo.encryptionEnabled ? "text-[#22c55e] bg-[#22c55e]/5" : "text-[#a3a3a3] hover:bg-[#f5f5f5]"}`}
                  title={selectedConvo.encryptionEnabled ? "E2E Encryption On — tap to disable" : "Encryption Off — tap to enable"}
                >
                  {selectedConvo.encryptionEnabled ? <ShieldCheck className="w-[18px] h-[18px]" /> : <Shield className="w-[18px] h-[18px]" />}
                </button>
                <button className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg"><Search className="w-[18px] h-[18px] md:w-5 md:h-5 text-[#737373]" /></button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 md:px-5 py-3 md:py-4 min-w-0">
              <div className="flex justify-center mb-4 md:mb-6">
                {selectedConvo.encryptionEnabled && (
                  <span className="px-3 py-1 rounded-full bg-[#22c55e]/10 text-[10px] text-[#22c55e] font-medium flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Messages are end-to-end encrypted
                  </span>
                )}
              </div>
              <div className="space-y-1.5 md:space-y-2">
                {displayMessages.map((msg: any, idx: number) => {
                  let storyReply: { type: string; storyImage: string; text: string } | null = null;
                  try {
                    if (msg.text.startsWith("{")) {
                      const parsed = JSON.parse(msg.text);
                      if (parsed.type === "story_reply") storyReply = parsed;
                    }
                  } catch {}

                  const isMine = msg.fromMe;
                  const timeStr = formatMessageTime(msg.createdAt, msg.time);
                  const isNew = msg.id < 0 || idx === displayMessages.length - 1;

                  return (
                    <motion.div
                      key={msg.id}
                      initial={isNew ? { opacity: 0, y: 8, scale: 0.97 } : false}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30, mass: 0.8 }}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`${storyReply ? "" : "max-w-[75%] md:max-w-[70%]"} rounded-2xl overflow-hidden ${isMine ? "bg-[#FFF0F0] text-[#0a0a0a] rounded-br-md" : "bg-white text-[#0a0a0a] rounded-bl-md shadow-[0_1px_2px_rgba(0,0,0,0.06)]"}`}>
                        {storyReply ? (
                          <div className="w-[200px] md:w-[240px]">
                            <div className="relative w-full aspect-[9/16] rounded-t-2xl overflow-hidden bg-[#0a0a0a]">
                              <Image src={storyReply.storyImage} alt="Story" fill className="object-cover" />
                              <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-black/50 to-transparent" />
                              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
                              <span className="absolute top-2.5 left-3 text-[10px] text-white/70 font-medium">Replied to story</span>
                            </div>
                            <div className="px-3 py-2 text-[13px] md:text-sm flex items-end justify-between gap-2">
                              <span>{storyReply.text}</span>
                              <span className="flex items-center gap-1 flex-shrink-0">
                                <span className="text-[10px] text-[#a3a3a3]">{timeStr}</span>
                                {isMine && <MessageStatus status={msg.status || "sent"} />}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="px-3.5 md:px-4 py-2 md:py-2.5 text-[13px] md:text-sm">
                            <span>{msg.text}</span>
                            <span className="inline-flex items-center gap-1 ml-2 float-right mt-1">
                              <span className="text-[10px] text-[#a3a3a3]">{timeStr}</span>
                              {isMine && <MessageStatus status={msg.status || "sent"} />}
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}

                {/* Typing indicator */}
                <AnimatePresence>
                  {otherUserTyping && <TypingDots />}
                </AnimatePresence>

                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Input */}
            <div className="px-3 md:px-4 py-2.5 md:py-3 bg-white border-t border-[#e5e5e5] flex items-center gap-2 sm:gap-3 flex-shrink-0 min-w-0">
              <input
                type="text"
                value={messageInput}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSendMessage(); }}
                placeholder="Type a message..."
                className="flex-1 bg-[#f5f5f5] rounded-full px-3.5 md:px-4 py-2 md:py-2.5 text-[13px] md:text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 min-w-0"
              />
              <motion.button
                onClick={handleSendMessage}
                disabled={!messageInput.trim()}
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-[#F44444] flex items-center justify-center flex-shrink-0 hover:bg-[#d64d3c] disabled:opacity-40 disabled:scale-100"
              >
                <ArrowUp className="w-[18px] h-[18px] md:w-5 md:h-5 text-white" />
              </motion.button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#a3a3a3] text-sm">
            Select a conversation
          </div>
        )}
      </div>
    </div>
  );
}

