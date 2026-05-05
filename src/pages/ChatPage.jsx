import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { listConversations, getConversation, sendMessage, searchUsers, getUserPublicKey, logout } from "../utils/api";
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
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [error, setError] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try { const res = await listConversations(); setConversations(res.data || []); } catch {}
  }, []);

  useEffect(() => {
    loadConversations();
    const i = setInterval(loadConversations, 5000);
    return () => clearInterval(i);
  }, [loadConversations]);

  const loadMessages = useCallback(async (uname) => {
    if (!uname) return;
    setLoadingMsgs(true);
    try {
      const res = await getConversation(uname);
      const raw = res.data || [];
      const decrypted = await Promise.all(raw.map(async (msg) => {
        const isSender = msg.sender_username === user.username;
        let payload = msg.encrypted_payload;
        if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch { payload = {}; } }
        const text = await decryptMessage(payload, user.username, isSender);
        return { ...msg, text, isSender };
      }));
      setMessages(decrypted);
    } catch { setError("Failed to load messages"); }
    finally { setLoadingMsgs(false); }
  }, [user.username]);

  useEffect(() => {
    if (!activeConvo) return;
    loadMessages(activeConvo);
    const i = setInterval(() => loadMessages(activeConvo), 4000);
    return () => clearInterval(i);
  }, [activeConvo, loadMessages]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try { const res = await searchUsers(searchQuery); setSearchResults((res.data || []).filter(u => u.username !== user.username)); } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery, user.username]);

  const openConvo = (uname) => {
    setActiveConvo(uname);
    setSearchQuery("");
    setSearchResults([]);
    setMessages([]);
    setError("");
    setShowSidebar(false);
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
    } catch (err) { setError(err.response?.data?.detail || "Failed to send"); }
    finally { setSending(false); }
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

  const isMobile = window.innerWidth < 768;

  const avatar = (size, letter) => (
    <div style={{ width:`${size}px`, height:`${size}px`, borderRadius:"50%", background:"#00d4aa", display:"flex", alignItems:"center", justifyContent:"center", color:"#000", fontWeight:700, fontSize:`${size*0.4}px`, flexShrink:0 }}>
      {letter}
    </div>
  );

  return (
    <div style={{ display:"flex", height:"100vh", width:"100vw", background:"#0a0c10", color:"#e2e4ea", fontFamily:"system-ui,sans-serif", overflow:"hidden" }}>

      {/* Sidebar */}
      {(!isMobile || showSidebar) && (
        <div style={{ width:"260px", minWidth:"260px", background:"#111318", borderRight:"1px solid rgba(255,255,255,0.06)", display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden" }}>

          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
            <span style={{ color:"#00d4aa", fontWeight:700, fontSize:"16px" }}>🔒 WhisperBox</span>
            <button onClick={handleLogout} style={{ background:"transparent", border:"1px solid rgba(255,255,255,0.1)", color:"#7c8096", borderRadius:"6px", padding:"5px 10px", cursor:"pointer", fontSize:"11px" }}>Logout</button>
          </div>

          <div style={{ padding:"10px 16px", borderBottom:"1px solid rgba(255,255,255,0.06)", fontSize:"13px", flexShrink:0 }}>
            <span style={{ color:"#00d4aa" }}>● </span>{user.username}
          </div>

          <div style={{ padding:"10px 14px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
            <input type="text" placeholder="Search users…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{ width:"100%", background:"#181b22", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"6px", padding:"8px 12px", color:"#e2e4ea", fontSize:"13px", outline:"none", boxSizing:"border-box" }} />
          </div>

          {searchResults.map(u => (
            <button key={u.username} onClick={() => openConvo(u.username)}
              style={{ display:"flex", alignItems:"center", gap:"10px", width:"100%", padding:"10px 16px", background:"transparent", border:"none", color:"#e2e4ea", cursor:"pointer", textAlign:"left", fontSize:"13px" }}>
              {avatar(30, u.username[0].toUpperCase())}
              <span>{u.username}</span>
            </button>
          ))}

          <div style={{ flex:1, overflowY:"auto" }}>
            {!searchQuery && <div style={{ padding:"6px 16px", fontSize:"10px", color:"#454858", textTransform:"uppercase", letterSpacing:"0.08em" }}>Conversations</div>}
            {!searchQuery && conversations.length === 0 && (
              <div style={{ padding:"16px", fontSize:"12px", color:"#454858", textAlign:"center" }}>Search for a user to start chatting</div>
            )}
            {!searchQuery && conversations.map(c => (
              <button key={c.other_username} onClick={() => openConvo(c.other_username)}
                style={{ display:"flex", alignItems:"center", gap:"10px", width:"100%", padding:"10px 16px", background: activeConvo === c.other_username ? "rgba(0,212,170,0.08)" : "transparent", border:"none", color:"#e2e4ea", cursor:"pointer", textAlign:"left", fontSize:"13px" }}>
                {avatar(30, c.other_username[0].toUpperCase())}
                <div>
                  <div style={{ fontSize:"13px" }}>{c.other_username}</div>
                  <div style={{ fontSize:"11px", color:"#454858" }}>🔒 encrypted</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main */}
      {(!isMobile || !showSidebar) && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", height:"100vh" }}>
          {!activeConvo ? (
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"12px", padding:"40px", textAlign:"center" }}>
              <div style={{ fontSize:"48px" }}>🔒</div>
              <h2 style={{ fontSize:"20px", color:"#e2e4ea", margin:0 }}>End-to-End Encrypted</h2>
              <p style={{ fontSize:"13px", color:"#7c8096", maxWidth:"280px", margin:0 }}>Search for a user to start a secure conversation.</p>
              <div style={{ marginTop:"16px", padding:"16px 20px", background:"#111318", border:"1px solid rgba(255,255,255,0.06)", borderRadius:"12px", textAlign:"left" }}>
                <div style={{ fontSize:"12px", color:"#7c8096", marginBottom:"6px" }}><strong style={{ color:"#00d4aa" }}>AES-GCM 256-bit</strong> message encryption</div>
                <div style={{ fontSize:"12px", color:"#7c8096", marginBottom:"6px" }}><strong style={{ color:"#00d4aa" }}>RSA-OAEP 2048-bit</strong> key exchange</div>
                <div style={{ fontSize:"12px", color:"#7c8096" }}><strong style={{ color:"#00d4aa" }}>Server never</strong> sees plaintext</div>
              </div>
              {isMobile && (
                <button onClick={() => setShowSidebar(true)}
                  style={{ marginTop:"16px", padding:"10px 20px", background:"#00d4aa", border:"none", borderRadius:"8px", color:"#000", fontWeight:700, cursor:"pointer", fontSize:"14px" }}>
                  Find Users
                </button>
              )}
            </div>
          ) : (
            <>
              <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"14px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", background:"#111318", flexShrink:0 }}>
                <button onClick={() => { setActiveConvo(null); setShowSidebar(true); }}
                  style={{ background:"transparent", border:"none", color:"#7c8096", cursor:"pointer", fontSize:"20px", padding:"0 8px 0 0" }}>←</button>
                {avatar(36, activeConvo[0].toUpperCase())}
                <div>
                  <div style={{ fontSize:"15px", fontWeight:600 }}>{activeConvo}</div>
                  <div style={{ fontSize:"10px", color:"#00d4aa" }}>🔒 End-to-end encrypted</div>
                </div>
              </div>

              <div style={{ flex:1, overflowY:"auto", padding:"20px", display:"flex", flexDirection:"column", gap:"6px" }}>
                {loadingMsgs && messages.length === 0 && (
                  <div style={{ textAlign:"center", fontSize:"12px", color:"#454858", padding:"20px" }}>Decrypting messages…</div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} style={{ display:"flex", justifyContent: msg.isSender ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth:"65%", padding:"10px 14px", borderRadius:"16px", background: msg.isSender ? "#003d33" : "#111318", border:`1px solid ${msg.isSender ? "#005244" : "rgba(255,255,255,0.06)"}`, borderBottomRightRadius: msg.isSender ? "4px" : "16px", borderBottomLeftRadius: msg.isSender ? "16px" : "4px", wordBreak:"break-word" }}>
                      <div style={{ fontSize:"14px", lineHeight:1.5 }}>{msg.text}</div>
                      <div style={{ fontSize:"10px", color:"#454858", marginTop:"4px", textAlign:"right" }}>{formatTime(msg.created_at)} 🔒</div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {error && <div style={{ padding:"8px 20px", fontSize:"12px", color:"#ff5c5c", background:"rgba(255,92,92,0.06)", flexShrink:0 }}>{error}</div>}

              <form onSubmit={handleSend} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"14px 20px", borderTop:"1px solid rgba(255,255,255,0.06)", background:"#111318", flexShrink:0 }}>
                <input type="text" placeholder="Type a message…" value={messageText} onChange={e => setMessageText(e.target.value)} disabled={sending} autoComplete="off"
                  style={{ flex:1, padding:"10px 16px", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"999px", background:"#181b22", color:"#e2e4ea", fontSize:"14px", outline:"none" }} />
                <button type="submit" disabled={sending || !messageText.trim()}
                  style={{ width:"40px", height:"40px", borderRadius:"50%", border:"none", background: sending || !messageText.trim() ? "#333" : "#00d4aa", color:"#000", cursor: sending || !messageText.trim() ? "not-allowed" : "pointer", fontSize:"16px", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>➤</button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
