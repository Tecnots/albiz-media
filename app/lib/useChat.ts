"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getOrCreateKeyPair, deriveSharedKey, encryptMessage, decryptMessage } from "./crypto";

// --- Types ---

interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  fromMe: boolean;
  text: string;
  time: string;
  status: string; // "sent" | "delivered" | "read" | "sending"
  encrypted: boolean;
  iv: string | null;
  createdAt: string;
}

interface ChatConversation {
  id: number;
  userId: number;
  lastMessage: string;
  time: string;
  unreadCount: number;
  online: boolean;
  messages: ChatMessage[];
  updatedAt: string;
  typingUserId: number | null;
  typingAt: string | null;
  encryptionEnabled: boolean;
  otherUserLastSeenAt: string | null;
  user?: {
    id: number;
    name: string;
    handle: string;
    avatar: string;
    lastSeenAt: string | null;
    role: string;
    verified: boolean;
    title: string;
  };
}

// --- Hook ---

export function useChat(
  currentUserId: number,
  activeConversationId: number | null
) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const serverTimeRef = useRef<string | null>(null);

  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const activeConvIdRef = useRef(activeConversationId);
  activeConvIdRef.current = activeConversationId;

  const lastTypingSentRef = useRef<Record<number, number>>({});
  const initialLoadDoneRef = useRef(false);

  // --- Polling ---

  const poll = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;

    try {
      const params = new URLSearchParams({ userId: String(currentUserId) });
      // Only use 'since' after first successful load
      if (initialLoadDoneRef.current && serverTimeRef.current) {
        params.set("since", serverTimeRef.current);
      }
      const res = await fetch(`/api/conversations?${params}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.serverTime) {
        serverTimeRef.current = data.serverTime;
      }

      const rawConvos = data.conversations ?? data;
      const incoming: ChatConversation[] = rawConvos.map((c: any) => ({
        ...c,
        otherUserLastSeenAt: c.otherUserLastSeenAt ?? c.user?.lastSeenAt ?? null,
      }));

      // Attempt to decrypt encrypted messages
      for (const conv of incoming) {
        for (const msg of conv.messages) {
          if (msg.encrypted && msg.iv && msg.text) {
            try {
              const sharedKey = await getSharedKey(conv.userId);
              if (sharedKey) {
                msg.text = await decryptMessage(sharedKey, msg.text, msg.iv);
                msg.encrypted = false;
              }
            } catch {
              // Decryption failed — show placeholder
              msg.text = "[Encrypted message]";
              msg.encrypted = false;
            }
          }
        }
      }

      if (!initialLoadDoneRef.current && incoming.length > 0) {
        // First load — set all conversations
        setConversations(incoming);
        initialLoadDoneRef.current = true;
      } else if (initialLoadDoneRef.current && incoming.length > 0) {
        // Incremental update
        setConversations((prev) => mergeConversations(prev, incoming));
      } else if (!initialLoadDoneRef.current) {
        // First load returned empty — mark done so we don't keep refetching everything
        initialLoadDoneRef.current = true;
      }
    } catch {
      // Silently ignore poll failures — next tick will retry
    }
  }, [currentUserId]);

  useEffect(() => {
    // Initial fetch
    poll();

    // Faster polling when a chat is active (1.5s), slower otherwise (5s)
    const intervalMs = activeConversationId ? 1500 : 5000;
    const id = setInterval(poll, intervalMs);

    return () => clearInterval(id);
  }, [poll, activeConversationId]);

  // --- Presence heartbeat ---

  useEffect(() => {
    const sendPresence = () => {
      fetch("/api/users/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId }),
      }).catch(() => {});
    };

    sendPresence();
    const id = setInterval(sendPresence, 15_000);
    return () => clearInterval(id);
  }, [currentUserId]);

  // --- Typing indicator ---

  const setTyping = useCallback(
    (conversationId: number) => {
      const now = Date.now();
      const last = lastTypingSentRef.current[conversationId] ?? 0;
      if (now - last < 2000) return; // debounce: at most once per 2s
      lastTypingSentRef.current[conversationId] = now;

      fetch("/api/conversations/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, userId: currentUserId }),
      }).catch(() => {});
    },
    [currentUserId]
  );

  const isTyping = useCallback(
    (conversationId: number): boolean => {
      const conv = conversationsRef.current.find(
        (c) => c.id === conversationId
      );
      if (!conv || !conv.typingUserId || !conv.typingAt) return false;
      if (conv.typingUserId === currentUserId) return false;
      const typingTime = new Date(conv.typingAt).getTime();
      return Date.now() - typingTime < 3000;
    },
    [currentUserId]
  );

  // --- Encryption key cache ---
  const sharedKeysRef = useRef<Map<number, CryptoKey>>(new Map());
  const privateKeyRef = useRef<CryptoKey | null>(null);

  // Initialize key pair on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    getOrCreateKeyPair(currentUserId)
      .then(({ privateKey, publicKey }) => {
        privateKeyRef.current = privateKey;
        // Upload public key so other users can derive shared key
        fetch("/api/users/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUserId, publicKey }),
        }).catch(() => {});
      })
      .catch(() => {});
  }, [currentUserId]);

  // Derive shared key for a conversation partner
  const getSharedKey = async (otherUserId: number): Promise<CryptoKey | null> => {
    const cached = sharedKeysRef.current.get(otherUserId);
    if (cached) return cached;
    if (!privateKeyRef.current) return null;
    try {
      // Get the other user's public key from the server
      const res = await fetch(`/api/users/stats?userId=${otherUserId}`);
      const data = await res.json();
      if (!data.publicKey) return null;
      const key = await deriveSharedKey(privateKeyRef.current, data.publicKey);
      sharedKeysRef.current.set(otherUserId, key);
      return key;
    } catch {
      return null;
    }
  };

  // --- Send message (API call only — page handles optimistic UI) ---

  const sendMessage = useCallback(
    (toUserId: number, text: string, storyImage?: string) => {
      const conv = conversationsRef.current.find(
        (c) => c.id === activeConvIdRef.current
      );
      const shouldEncrypt = conv?.encryptionEnabled ?? false;

      const doSend = async () => {
        const body: Record<string, unknown> = { fromUserId: currentUserId, toUserId, text };
        if (storyImage) body.storyImage = storyImage;

        if (shouldEncrypt) {
          try {
            const sharedKey = await getSharedKey(toUserId);
            if (sharedKey) {
              const { ciphertext, iv } = await encryptMessage(sharedKey, text);
              body.text = ciphertext;
              body.encrypted = true;
              body.iv = iv;
            }
          } catch {
            // Encryption failed — send plaintext
          }
        }

        await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      };

      doSend().catch(() => {});
    },
    [currentUserId]
  );

  // --- Start new conversation ---

  const startConversation = useCallback(
    async (toUserId: number): Promise<number | null> => {
      // Check if conversation already exists locally
      const existing = conversationsRef.current.find(
        (c) => c.userId === toUserId
      );
      if (existing) return existing.id;

      // Send a handshake message to create the conversation, or just poll
      // We'll create it on first message send, return null to indicate "new"
      return null;
    },
    []
  );

  // --- Toggle encryption ---

  const toggleEncryption = useCallback((conversationId: number) => {
    // Optimistic local toggle
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, encryptionEnabled: !c.encryptionEnabled }
          : c
      )
    );

    // Persist to server
    const conv = conversationsRef.current.find((c) => c.id === conversationId);
    const next = !(conv?.encryptionEnabled ?? true);
    fetch("/api/conversations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, encryptionEnabled: next }),
    }).catch(() => {});
  }, []);

  // --- Mark read ---

  const markRead = useCallback((conversationId: number) => {
    // Optimistically zero out unread count
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      )
    );

    fetch("/api/conversations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId }),
    }).catch(() => {});
  }, []);

  // --- Force refresh (for after starting new conversations) ---

  const forceRefresh = useCallback(() => {
    serverTimeRef.current = null;
    initialLoadDoneRef.current = false;
    poll();
  }, [poll]);

  // --- Edit message ---

  const editMessage = useCallback((messageId: number, newText: string) => {
    // Optimistic local update
    setConversations((prev) =>
      prev.map((c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === messageId ? { ...m, text: newText, edited: true } : m
        ),
      }))
    );
    fetch(`/api/messages/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newText }),
    }).catch(() => {});
  }, []);

  // --- Delete message ---

  const deleteMessage = useCallback((messageId: number) => {
    setConversations((prev) =>
      prev.map((c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === messageId ? { ...m, deleted: true, text: "" } : m
        ),
      }))
    );
    fetch(`/api/messages/${messageId}`, { method: "DELETE" }).catch(() => {});
  }, []);

  // --- Clear chat ---

  const clearChat = useCallback((conversationId: number) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [], lastMessage: "" }
          : c
      )
    );
    fetch(`/api/conversations/${conversationId}/clear`, { method: "POST" }).catch(() => {});
  }, []);

  // --- Save/unsave message ---

  const saveMessage = useCallback((messageId: number, saved: boolean) => {
    setConversations((prev) =>
      prev.map((c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === messageId ? { ...m, savedByUser: saved ? currentUserId : null } : m
        ),
      }))
    );
    const method = saved ? "POST" : "DELETE";
    fetch(`/api/messages/${messageId}/save`, { method }).catch(() => {});
  }, [currentUserId]);

  return {
    conversations,
    isTyping,
    sendMessage,
    markRead,
    setTyping,
    toggleEncryption,
    startConversation,
    forceRefresh,
    editMessage,
    deleteMessage,
    clearChat,
    saveMessage,
    serverTime: serverTimeRef.current,
  };
}

// --- Merge logic ---
// Merges incoming server data with existing local state, preserving optimistic
// messages that haven't been confirmed yet.

function mergeConversations(
  existing: ChatConversation[],
  incoming: ChatConversation[]
): ChatConversation[] {
  const existingMap = new Map(existing.map((c) => [c.id, c]));

  const merged: ChatConversation[] = incoming.map((inc) => {
    const prev = existingMap.get(inc.id);
    if (!prev) return inc;

    // Merge messages: keep optimistic (negative id) messages that aren't
    // confirmed, add all server messages
    const optimisticMessages = prev.messages.filter(
      (m) => m.id < 0 && m.status === "sending"
    );

    // Filter out optimistic messages whose text matches a newly arrived
    // server message (likely the confirmed version)
    const unconfirmedOptimistic = optimisticMessages.filter((opt) => {
      return !inc.messages.some(
        (srv) =>
          srv.fromMe &&
          srv.text === opt.text &&
          Math.abs(
            new Date(srv.createdAt).getTime() -
              new Date(opt.createdAt).getTime()
          ) < 30_000
      );
    });

    return {
      ...inc,
      messages: [...inc.messages, ...unconfirmedOptimistic],
    };
  });

  // Keep any existing conversations not in the incoming set (shouldn't happen
  // normally, but defensive)
  const incomingIds = new Set(incoming.map((c) => c.id));
  for (const prev of existing) {
    if (!incomingIds.has(prev.id)) {
      merged.push(prev);
    }
  }

  return merged;
}
