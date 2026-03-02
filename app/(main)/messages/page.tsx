"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { Search, Settings, Mic, ArrowUp, Plus, ArrowLeft } from "lucide-react";
import { conversations as fallbackConvos, messageTabs, users as fallbackUsers } from "@/app/lib/data";
import { VerifiedBadge } from "@/app/lib/shared-components";
import { api } from "@/app/lib/api";

export default function MessagesPage() {
  const [conversations, setConversations] = useState(fallbackConvos);
  const [users, setUsers] = useState(fallbackUsers);
  const [activeConvo, setActiveConvo] = useState(fallbackConvos[0]?.id || 1);
  const [activeTab, setActiveTab] = useState(0);
  const [messageInput, setMessageInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([api.getConversations(), api.getUsers()])
      .then(([c, u]) => { setConversations(c); setUsers(u); if (c.length) setActiveConvo(c[0].id); })
      .catch(() => {});
  }, []);

  const selectedConvo = conversations.find(c => c.id === activeConvo) || conversations[0];
  const selectedUser = selectedConvo ? users.find(u => u.id === selectedConvo.userId) : null;
  const filteredConvos = activeTab === 1 ? conversations.filter(c => c.unreadCount > 0) : conversations;

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeConvo]);

  const handleSelectConvo = (id: number) => { setActiveConvo(id); setShowChat(true); };

  return (
    <div className="flex-1 flex min-w-0 h-full">
      {/* Conversation list */}
      <div className={`flex-shrink-0 border-r border-[#e5e5e5] flex flex-col h-full bg-white overflow-hidden ${showChat ? "hidden md:flex md:w-80" : "w-full md:w-80"}`}>
        <div className="px-4 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-semibold">Messages</h1>
            <div className="flex items-center gap-1">
              <button className="p-2 hover:bg-[#f5f5f5] rounded-lg"><Search className="w-5 h-5 text-[#737373]" /></button>
              <button className="p-2 hover:bg-[#f5f5f5] rounded-lg"><Settings className="w-5 h-5 text-[#737373]" /></button>
            </div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {messageTabs.map((tab, i) => (
              <button key={tab} onClick={() => setActiveTab(i)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${i === activeTab ? "bg-[#F44444] text-white" : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"}`}>{tab}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConvos.map(convo => {
            const convoUser = users.find(u => u.id === convo.userId);
            if (!convoUser) return null;
            return (
              <button key={convo.id} onClick={() => handleSelectConvo(convo.id)} className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${convo.id === activeConvo ? "bg-[#f5f5f5]" : "hover:bg-[#fafafa]"}`}>
                <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
                  <Image src={convoUser.avatar} alt={convoUser.name} width={44} height={44} className="object-cover w-full h-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`text-sm truncate ${convo.unreadCount > 0 ? "font-semibold" : "font-medium"} text-[#0a0a0a]`}>{convoUser.name}</span>
                      {convoUser.verified && <VerifiedBadge className="scale-75 flex-shrink-0" />}
                    </div>
                    <span className="text-[11px] text-[#a3a3a3] flex-shrink-0 ml-2">{convo.time}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className={`text-xs truncate ${convo.unreadCount > 0 ? "text-[#525252] font-medium" : "text-[#737373]"}`}>{convo.lastMessage}</span>
                    {convo.unreadCount > 0 && <span className="w-5 h-5 rounded-full bg-[#F44444] text-white text-[10px] font-semibold flex items-center justify-center flex-shrink-0 ml-2">{convo.unreadCount}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat panel */}
      <div className={`flex-1 flex flex-col h-full bg-[#fafafa] min-w-0 ${!showChat ? "hidden md:flex" : "flex"}`}>
        <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-[#e5e5e5] flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowChat(false)} className="md:hidden p-1.5 hover:bg-[#f5f5f5] rounded-lg -ml-1"><ArrowLeft className="w-5 h-5 text-[#525252]" /></button>
            <div className="w-11 h-11 rounded-full overflow-hidden ring-1 ring-[#e5e5e5]">
              <Image src={selectedUser.avatar} alt={selectedUser.name} width={44} height={44} className="object-cover w-full h-full" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-sm">{selectedUser.name}</span>
                {selectedUser.verified && <VerifiedBadge className="scale-90" />}
              </div>
              {selectedConvo.online ? <span className="text-xs text-[#22c55e] font-medium">Online</span> : <span className="text-xs text-[#a3a3a3]">Offline</span>}
            </div>
          </div>
          <button className="p-2 hover:bg-[#f5f5f5] rounded-lg"><Search className="w-5 h-5 text-[#737373]" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex justify-center mb-6">
            <span className="px-3 py-1 rounded-full bg-[#e5e5e5] text-[11px] text-[#737373] font-medium">Today</span>
          </div>
          <div className="space-y-3">
            {selectedConvo.messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${msg.fromMe ? "bg-[#FFF0F0] text-[#0a0a0a] rounded-br-md" : "bg-white text-[#0a0a0a] rounded-bl-md shadow-[0_1px_2px_rgba(0,0,0,0.06)]"}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>

        <div className="px-4 py-3 bg-white border-t border-[#e5e5e5] flex items-center gap-3 flex-shrink-0">
          <button className="p-2 hover:bg-[#f5f5f5] rounded-full flex-shrink-0"><Plus className="w-5 h-5 text-[#737373]" /></button>
          <input type="text" value={messageInput} onChange={e => setMessageInput(e.target.value)} placeholder="Type a message..." className="flex-1 bg-[#f5f5f5] rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20" />
          <button className="p-2 hover:bg-[#f5f5f5] rounded-full flex-shrink-0"><Mic className="w-5 h-5 text-[#737373]" /></button>
          <button className="w-10 h-10 rounded-full bg-[#F44444] flex items-center justify-center flex-shrink-0 hover:bg-[#d64d3c]"><ArrowUp className="w-5 h-5 text-white" /></button>
        </div>
      </div>
    </div>
  );
}
