"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getOrCreateKeyPair,
  deriveSharedKey,
  decryptMessage,
  encryptMessage,
} from "./crypto";
import {
  RatchetSession,
  initSenderSession,
  initReceiverSession,
  ratchetEncrypt,
  ratchetDecrypt,
  saveRatchetSession,
  loadRatchetSession,
} from "./ratchet";
import { isNative } from "@/app/lib/capacitor";

// --- Types ---

interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  fromMe: boolean;
  text: string;
  time: string;
  status: string;
  encrypted: boolean;
  iv: string | null;
  msgIndex: number;
  ratchetPublicKey: string | null;
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
  const serverTimeRef     = useRef<string | null>(null);
  const conversationsRef  = useRef(conversations);
  conversationsRef.current = conversations;

  const activeConvIdRef = useRef(activeConversationId);
  activeConvIdRef.current = activeConversationId;

  const lastTypingSentRef     = useRef<Record<number, number>>({});
  const initialLoadDoneRef    = useRef(false);
  const decryptedMessageIds   = useRef<Set<number>>(new Set()); // avoid double-decrypt on poll
  const pendingReadsRef       = useRef<Set<number>>(new Set()); // markRead calls awaiting server confirmation
  const inFlightReadsRef      = useRef<Set<number>>(new Set()); // markRead requests currently in flight (dedupe)

  // Identity key refs
  const identPrivKeyRef    = useRef<CryptoKey | null>(null);
  const identPubKeyB64Ref  = useRef<string | null>(null);

  // Legacy shared-key cache (for backward-compat decryption of pre-ratchet messages)
  const legacySharedKeyCache = useRef<Map<number, CryptoKey>>(new Map());
  const legacyKeySourceCache = useRef<Map<number, string>>(new Map()); // otherUserId → their pubKey

  // In-memory ratchet session cache (also backed by IndexedDB via ratchet.ts)
  const ratchetSessionCache = useRef<Map<number, RatchetSession>>(new Map());

  // --- Load identity key pair on mount ---

  useEffect(() => {
    if (typeof window === "undefined") return;
    getOrCreateKeyPair(currentUserId)
      .then(({ privateKey, publicKey }) => {
        identPrivKeyRef.current = privateKey;
        identPubKeyB64Ref.current = publicKey;
        fetch("/api/users/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUserId, publicKey }),
        }).catch(() => {});
      })
      .catch(() => {});
  }, [currentUserId]);

  // --- Fetch other user's identity public key ---

  const getTheirIdentPubKey = useCallback(async (otherUserId: number): Promise<string | null> => {
    try {
      const res = await fetch(`/api/users/stats?userId=${otherUserId}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.publicKey || null;
    } catch {
      return null;
    }
  }, []);

  // --- Legacy shared key (for pre-ratchet messages) ---

  const getLegacySharedKey = useCallback(async (otherUserId: number): Promise<CryptoKey | null> => {
    if (!identPrivKeyRef.current) return null;
    try {
      const theirPub = await getTheirIdentPubKey(otherUserId);
      if (!theirPub) return null;

      const cached  = legacySharedKeyCache.current.get(otherUserId);
      const source  = legacyKeySourceCache.current.get(otherUserId);
      if (cached && source === theirPub) return cached;

      const key = await deriveSharedKey(identPrivKeyRef.current, theirPub);
      legacySharedKeyCache.current.set(otherUserId, key);
      legacyKeySourceCache.current.set(otherUserId, theirPub);
      return key;
    } catch {
      return null;
    }
  }, [getTheirIdentPubKey]);

  // --- Get or initialize ratchet session ---

  const getRatchetSession = useCallback(async (
    otherUserId: number,
    asInitiator: boolean,
    theirRatchetPubB64?: string, // required when asInitiator=false
  ): Promise<RatchetSession | null> => {
    if (!identPrivKeyRef.current) return null;

    // Memory cache
    const cached = ratchetSessionCache.current.get(otherUserId);
    if (cached?.ready) return cached;

    // IndexedDB
    const stored = await loadRatchetSession(otherUserId);
    if (stored?.ready) {
      ratchetSessionCache.current.set(otherUserId, stored);
      return stored;
    }

    // Initialize a new session
    const theirIdentPub = await getTheirIdentPubKey(otherUserId);
    if (!theirIdentPub) return null;

    let session: RatchetSession;
    if (asInitiator) {
      session = await initSenderSession(identPrivKeyRef.current, theirIdentPub, otherUserId);
    } else {
      if (!theirRatchetPubB64) return null;
      session = await initReceiverSession(
        identPrivKeyRef.current, theirIdentPub, theirRatchetPubB64, otherUserId
      );
    }

    ratchetSessionCache.current.set(otherUserId, session);
    await saveRatchetSession(session);
    return session;
  }, [getTheirIdentPubKey]);

  // --- Decrypt a single message (ratchet-aware with legacy fallback) ---

  const decryptSingleMessage = useCallback(async (
    msg: ChatMessage,
    otherUserId: number
  ): Promise<{ text: string; session?: RatchetSession }> => {
    if (!msg.encrypted || !msg.iv || !msg.text) return { text: msg.text };

    // Ratchet path
    if (msg.ratchetPublicKey !== null && msg.ratchetPublicKey !== undefined) {
      // Load existing session or initialize as responder
      let session = ratchetSessionCache.current.get(otherUserId)
        ?? await loadRatchetSession(otherUserId);

      if (!session || !session.ready) {
        // Responder: initialize from this first message's header
        const theirIdentPub = await getTheirIdentPubKey(otherUserId);
        if (!theirIdentPub || !identPrivKeyRef.current) {
          return { text: "[Encrypted message]" };
        }
        try {
          session = await initReceiverSession(
            identPrivKeyRef.current,
            theirIdentPub,
            msg.ratchetPublicKey,
            otherUserId
          );
        } catch {
          return { text: "[Encrypted message]" };
        }
      }

      try {
        const result = await ratchetDecrypt(
          session,
          { ratchetPublicKey: msg.ratchetPublicKey, msgIndex: msg.msgIndex ?? 0 },
          msg.text,
          msg.iv
        );
        return { text: result.plaintext, session: result.session };
      } catch {
        return { text: "[Encrypted message]" };
      }
    }

    // Legacy path (pre-ratchet messages — static ECDH shared key)
    try {
      const sharedKey = await getLegacySharedKey(otherUserId);
      if (!sharedKey) return { text: "[Encrypted message]" };
      const plaintext = await decryptMessage(sharedKey, msg.text, msg.iv);
      return { text: plaintext };
    } catch {
      return { text: "[Encrypted message]" };
    }
  }, [getTheirIdentPubKey, getLegacySharedKey]);

  // --- Mark read ---
  // The single place a conversation's read-state gets persisted. Called
  // explicitly when a conversation is opened, and re-invoked from poll()
  // below whenever the server still reports unread messages for whichever
  // conversation is currently active — so it self-heals regardless of *how*
  // the conversation became active (list click, deep link, default
  // auto-select) or whether new messages arrived while it stayed open.

  const markRead = useCallback(async (conversationId: number) => {
    setConversations(prev =>
      prev.map(c => c.id === conversationId ? { ...c, unreadCount: 0 } : c)
    );
    pendingReadsRef.current.add(conversationId);

    // Poll ticks and explicit calls (list click + active-conversation catch-up
    // + pending-retry sweep) can overlap for the same id — only one request
    // for it should ever be in flight at a time.
    if (inFlightReadsRef.current.has(conversationId)) return;
    inFlightReadsRef.current.add(conversationId);

    try {
      const res = await fetch("/api/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      // A 4xx means this conversation isn't ours / no longer exists — retrying
      // won't help, so stop. Anything else (5xx) is left pending for retry.
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        pendingReadsRef.current.delete(conversationId);
      }
    } catch {
      // Network failure — left pending, retried once connectivity returns.
    } finally {
      inFlightReadsRef.current.delete(conversationId);
    }
  }, []);

  // --- Polling ---

  const poll = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden && !isNative) return;

    // Retry any read receipts that failed to reach the server earlier
    // (e.g. a network drop) — piggybacks the existing poll cadence instead
    // of a dedicated timer.
    if (pendingReadsRef.current.size > 0) {
      for (const id of Array.from(pendingReadsRef.current)) markRead(id);
    }

    try {
      const params = new URLSearchParams({ userId: String(currentUserId) });
      if (initialLoadDoneRef.current && serverTimeRef.current) {
        params.set("since", serverTimeRef.current);
      }
      const res = await fetch(`/api/conversations?${params}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.serverTime) serverTimeRef.current = data.serverTime;

      const rawConvos = data.conversations ?? data;
      const incoming: ChatConversation[] = rawConvos.map((c: any) => ({
        ...c,
        otherUserLastSeenAt: c.otherUserLastSeenAt ?? c.user?.lastSeenAt ?? null,
      }));

      // The active conversation is being looked at right now — if the server
      // still shows it unread (just opened, or a new message landed while it
      // stayed open), persist the read receipt and reflect it as read in this
      // response immediately, rather than letting the stale server value
      // flow into state and briefly reintroduce the badge.
      const activeId = activeConvIdRef.current;
      if (activeId != null) {
        const activeIncoming = incoming.find(c => c.id === activeId);
        if (activeIncoming && activeIncoming.unreadCount > 0) {
          activeIncoming.unreadCount = 0;
          markRead(activeId);
        }
      }

      // Decrypt encrypted messages in-order per conversation
      for (const conv of incoming) {
        const otherUserId = conv.userId;

        // Sort by DB id (ascending) so we advance the ratchet in the correct order
        const sorted = [...conv.messages].sort((a, b) => a.id - b.id);
        let sessionDirty = false;

        for (const msg of sorted) {
          if (!msg.encrypted || decryptedMessageIds.current.has(msg.id)) continue;

          const { text, session } = await decryptSingleMessage(msg, otherUserId);
          msg.text = text;
          msg.encrypted = false;

          if (session) {
            ratchetSessionCache.current.set(otherUserId, session);
            sessionDirty = true;
          }

          if (msg.id > 0) {
            decryptedMessageIds.current.add(msg.id);
            // Cap the set to avoid unbounded memory growth in long-lived sessions
            if (decryptedMessageIds.current.size > 2000) {
              const oldest = decryptedMessageIds.current.values().next().value;
              if (oldest !== undefined) decryptedMessageIds.current.delete(oldest);
            }
          }
        }

        // Persist updated ratchet session after processing all messages in this conv
        if (sessionDirty) {
          const sess = ratchetSessionCache.current.get(otherUserId);
          if (sess) await saveRatchetSession(sess);
        }
      }

      if (!initialLoadDoneRef.current && incoming.length > 0) {
        setConversations(incoming);
        initialLoadDoneRef.current = true;
      } else if (initialLoadDoneRef.current && incoming.length > 0) {
        setConversations(prev => mergeConversations(prev, incoming));
      } else if (!initialLoadDoneRef.current) {
        initialLoadDoneRef.current = true;
      }
    } catch {
      // Ignore poll failures — next tick retries
    }
  }, [currentUserId, decryptSingleMessage, markRead]);

  useEffect(() => {
    poll();
    const intervalMs = activeConversationId ? 1500 : 5000;
    const id = setInterval(poll, intervalMs);
    return () => clearInterval(id);
  }, [poll, activeConversationId]);

  // --- Presence heartbeat ---

  useEffect(() => {
    const send = () => {
      fetch("/api/users/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId }),
      }).catch(() => {});
    };
    send();
    const id = setInterval(send, 15_000);
    return () => clearInterval(id);
  }, [currentUserId]);

  // --- Typing indicator ---

  const setTyping = useCallback((conversationId: number) => {
    const now  = Date.now();
    const last = lastTypingSentRef.current[conversationId] ?? 0;
    if (now - last < 2000) return;
    lastTypingSentRef.current[conversationId] = now;
    fetch("/api/conversations/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, userId: currentUserId }),
    }).catch(() => {});
  }, [currentUserId]);

  const isTyping = useCallback((conversationId: number): boolean => {
    const conv = conversationsRef.current.find(c => c.id === conversationId);
    if (!conv?.typingUserId || !conv.typingAt) return false;
    if (conv.typingUserId === currentUserId) return false;
    return Date.now() - new Date(conv.typingAt).getTime() < 3000;
  }, [currentUserId]);

  // --- Send message ---
  // Returns the confirmed server messageId on success, or null on failure.
  // The caller uses this to swap the optimistic temp-ID for the real one and
  // to surface a "failed" state when the network request does not resolve.

  const sendMessage = useCallback(
    async (toUserId: number, text: string, storyImage?: string): Promise<{ messageId: number } | null> => {
      const conv        = conversationsRef.current.find(c => c.id === activeConvIdRef.current);
      const shouldEncrypt = conv?.encryptionEnabled ?? false;

      const body: Record<string, unknown> = {
        fromUserId: currentUserId,
        toUserId,
        text,
      };
      if (storyImage) body.storyImage = storyImage;

      if (shouldEncrypt && identPrivKeyRef.current) {
        const session = await getRatchetSession(toUserId, true);
        if (!session) {
          throw new Error("Encryption session unavailable — message not sent");
        }
        const result = await ratchetEncrypt(session, text);
        await saveRatchetSession(result.session);
        ratchetSessionCache.current.set(toUserId, result.session);
        body.text             = result.ciphertext;
        body.encrypted        = true;
        body.iv               = result.iv;
        body.msgIndex         = result.msgIndex;
        body.ratchetPublicKey = result.ratchetPublicKey;
      }

      try {
        const SEND_TIMEOUT_MS = 15_000;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) return null;
        const data = await res.json();
        return typeof data.messageId === "number" ? { messageId: data.messageId } : null;
      } catch {
        return null;
      }
    },
    [currentUserId, getRatchetSession]
  );

  // --- Start new conversation ---

  const startConversation = useCallback(async (toUserId: number): Promise<number | null> => {
    const existing = conversationsRef.current.find(c => c.userId === toUserId);
    if (existing) return existing.id;
    return null;
  }, []);

  // --- Toggle encryption ---

  const toggleEncryption = useCallback((conversationId: number) => {
    setConversations(prev =>
      prev.map(c =>
        c.id === conversationId ? { ...c, encryptionEnabled: !c.encryptionEnabled } : c
      )
    );
    const conv = conversationsRef.current.find(c => c.id === conversationId);
    const next = !(conv?.encryptionEnabled ?? true);
    fetch("/api/conversations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, encryptionEnabled: next }),
    }).catch(() => {});
  }, []);

  // --- Force refresh ---

  const forceRefresh = useCallback(() => {
    serverTimeRef.current      = null;
    initialLoadDoneRef.current = false;
    poll();
  }, [poll]);

  // --- Edit message ---
  // In the Double Ratchet, editing re-encrypts with the CURRENT chain state
  // (not the original message key, which has been deleted).  The server stores
  // the new ciphertext/IV and marks it as edited.

  const editMessage = useCallback((messageId: number, newText: string) => {
    // Find message metadata in local state
    const allConvs = conversationsRef.current;
    let wasEncrypted = false;
    let otherUserId: number | null = null;
    let hadRatchetPub: string | null = null;

    for (const c of allConvs) {
      const found = c.messages.find(m => m.id === messageId);
      if (found) {
        wasEncrypted = found.encrypted || !!found.ratchetPublicKey;
        otherUserId  = c.userId;
        hadRatchetPub = found.ratchetPublicKey ?? null;
        break;
      }
    }

    // Optimistic local update
    setConversations(prev =>
      prev.map(c => ({
        ...c,
        messages: c.messages.map(m =>
          m.id === messageId ? { ...m, text: newText, edited: true } : m
        ),
      }))
    );

    const doEdit = async () => {
      let payload: Record<string, unknown> = { text: newText };

      if (wasEncrypted && otherUserId !== null) {
        if (hadRatchetPub) {
          // Ratchet path: encrypt with current sending chain
          const session = ratchetSessionCache.current.get(otherUserId)
            ?? await loadRatchetSession(otherUserId);
          if (!session?.sendChainKey) {
            throw new Error("Encryption session unavailable — edit not sent");
          }
          const result = await ratchetEncrypt(session, newText);
          await saveRatchetSession(result.session);
          ratchetSessionCache.current.set(otherUserId, result.session);
          payload = {
            text:             result.ciphertext,
            encrypted:        true,
            iv:               result.iv,
            msgIndex:         result.msgIndex,
            ratchetPublicKey: result.ratchetPublicKey,
          };
        } else {
          // Legacy path: re-encrypt with static shared key
          const sharedKey = await getLegacySharedKey(otherUserId);
          if (!sharedKey) {
            throw new Error("Encryption key unavailable — edit not sent");
          }
          const { ciphertext, iv } = await encryptMessage(sharedKey, newText);
          payload = { text: ciphertext, encrypted: true, iv };
        }
      }

      await fetch(`/api/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    };

    doEdit().catch(() => {});
  }, [getLegacySharedKey]);

  // --- Delete message ---

  const deleteMessage = useCallback((messageId: number) => {
    setConversations(prev =>
      prev.map(c => ({
        ...c,
        messages: c.messages.map(m =>
          m.id === messageId ? { ...m, deleted: true, text: "" } : m
        ),
      }))
    );
    fetch(`/api/messages/${messageId}`, { method: "DELETE" }).catch(() => {});
  }, []);

  // --- Clear chat ---

  const clearChat = useCallback((conversationId: number) => {
    setConversations(prev =>
      prev.map(c =>
        c.id === conversationId ? { ...c, messages: [], lastMessage: "" } : c
      )
    );
    fetch(`/api/conversations/${conversationId}/clear`, { method: "POST" }).catch(() => {});
  }, []);

  // --- Save / unsave message ---

  const saveMessage = useCallback((messageId: number, saved: boolean) => {
    setConversations(prev =>
      prev.map(c => ({
        ...c,
        messages: c.messages.map(m =>
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

function mergeConversations(
  existing: ChatConversation[],
  incoming: ChatConversation[]
): ChatConversation[] {
  const existingMap = new Map(existing.map(c => [c.id, c]));

  const merged = incoming.map(inc => {
    const prev = existingMap.get(inc.id);
    if (!prev) return inc;

    // Keep optimistic messages whose server confirmation has not arrived yet.
    // Primary signal: _confirmedServerId set when the POST resolved successfully.
    // Fallback: text+time fuzzy match (only used when server ID is unknown, e.g.
    // slow connection where we haven't received the POST response yet).
    const optimistic  = prev.messages.filter((m: any) => m.id < 0 && m.status === "sending");
    const unconfirmed = optimistic.filter((opt: any) =>
      !inc.messages.some(srv => {
        if (!srv.fromMe) return false;
        if (opt._confirmedServerId) return srv.id === opt._confirmedServerId;
        return srv.text === opt.text &&
          Math.abs(new Date(srv.createdAt).getTime() - new Date(opt.createdAt).getTime()) < 30_000;
      })
    );

    return { ...inc, messages: [...inc.messages, ...unconfirmed] };
  });

  const incomingIds = new Set(incoming.map(c => c.id));
  for (const prev of existing) {
    if (!incomingIds.has(prev.id)) merged.push(prev);
  }

  return merged;
}
