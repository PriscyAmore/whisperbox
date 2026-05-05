import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
  listConversations,
  getConversation,
  sendMessage,
  searchUsers,
  getUserPublicKey,
  logout,
} from "../utils/api";
import { encryptMessage, decryptMessage, deleteKeys } from "../utils/crypto";

export default function ChatPage() {
  const { user, signOut } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await listConversations();
      setConversations(res.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  const loadMessages = useCallback(async (username) => {
    if (!username) return;
    setLoadingMessages(true);
    try {
      const res = await getConversation(username);
      const raw = res.data || [];
      const decrypted = await Promise.all(
        raw.map(async (msg) => {
          const isSender = msg.sender_username === user.username;
          let payload = msg.encrypted_payload;
          if (typeof payload === "string") {
            try { payload = JSON.parse(payload); } catch { payload = {}; }
          }
          const text = await decryptMessage(payload, user.username, isSender);
          return { ...msg, text, isSender };
        })
      );
      setMessages(decrypted);
    } catch {
      setError("Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  }, [user.username]);

  useEffect(() => {
    if (!activeConvo) return;
    loadMessages(activeConvo);
    const interval = setInterval(() => loadMessages(activeConvo), 4000);
    return () => clearInterval(interval);
  }, [activeConvo, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await searchUsers(searchQuery);
        setSearchResults((res.data || []).filter((u) => u.username !== user.username));
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery, user.username]);

  const openConvo = (username) => {
    setActiveConvo(username);
    setSearchQuery("");
    setSearchResults([]);
    setMessages([]);
    setError("");
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !activeConvo || sending) return;
    setSending(true);
    setError("");
    try {
      const pkRes = await getUserPublicKey(activeConvo);
      const recipientPublicKey = pkRes.data.public_key;
      const myPkRes = await getUserPublicKey(user.username);
      const senderPublicKey = myPkRes.data.public_key;
      const encrypted = await encryptMessage(messageText, recipientPublicKey, senderPublicKey);
      await sendMessage(activeConvo, encrypted);
      setMessageText("");
      await loadMessages(activeConvo);
      await loadConversations();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleLogout = async () => {
    try { await logout(); } catch {}
    await deleteKeys(user.username);
    signOut();
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="chat-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span>WhisperBox</span>
          </div>
          <button className="icon-btn" onClick={handleLogout} title="Sign out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>

        <div className="user-chip">
          <div className="avatar">{user.username[0].toUpperCase()}</div>
          <div>
            <div className="username">{user.username}</div>
            <div className="enc-badge">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              Keys active
            </div>
          </div>
        </div>

        <div className="search-wrap">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            placeholder="Search users…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {searchResults.length > 0 && (
          <div className="search-results">
            <div className="list-label">Users</div>
            {searchResults.map((u) => (
              <button key={u.username} className="convo-item" onClick={() => openConvo(u.username)}>
                <div className="avatar sm">{u.username[0].toUpperCase()}</div>
                <span>{u.username}</span>
              </button>
            ))}
          </div>
        )}

        <div className="convo-list">
          {!searchQuery && <div className="list-label">Conversations</div>}
          {!searchQuery && conversations.length === 0 && (
            <div className="empty-convo">Search for a user to start chatting</div>
          )}
          {!searchQuery && conversations.map((c) => (
            <button
              key={c.other_username}
              className={`convo-item ${activeConvo === c.other_username ? "active" : ""}`}
              onClick={() => openConvo(c.other_username)}
            >
              <div className="avatar sm">{c.other_username[0].toUpperCase()}</div>
              <div className="convo-meta">
                <span className="convo-name">{c.other_username}</span>
                <span className="convo-preview">🔒 encrypted</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <main className="chat-main">
        {!activeConvo ? (
          <div className="chat-empty">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h2>End-to-End Encrypted</h2>
            <p>Select a conversation or search for a user to start messaging securely.</p>
            <div className="enc-info">
              <div className="enc-item"><strong>AES-GCM 256-bit</strong> message encryption</div>
              <div className="enc-item"><strong>RSA-OAEP 2048-bit</strong> key exchange</div>
              <div className="enc-item"><strong>Server never</strong> sees plaintext</div>
            </div>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <button className="icon-btn mobile-back" onClick={() => setActiveConvo(null)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div className="avatar">{activeConvo[0].toUpperCase()}</div>
              <div>
                <div className="chat-header-name">{activeConvo}</div>
                <div className="enc-badge">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  End-to-end encrypted
                </div>
              </div>
            </div>

            <div className="messages-area">
              {loadingMessages && messages.length === 0 && (
                <div className="loading-msgs">Decrypting messages…</div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`message-wrap ${msg.isSender ? "sent" : "received"}`}>
                  <div className={`bubble ${msg.isSender ? "sent" : "received"}`}>
                    <span className="bubble-text">{msg.text}</span>
                    <div className="bubble-meta">
                      <span className="bubble-time">{formatTime(msg.created_at)}</span>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {error && <div className="chat-error">{error}</div>}

            <form className="message-input-wrap" onSubmit={handleSend}>
              <input
                type="text"
                className="message-input"
                placeholder="Type a message…"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                disabled={sending}
                autoComplete="off"
              />
              <button type="submit" className="send-btn" disabled={sending || !messageText.trim()}>
                {sending ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinning"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                )}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
