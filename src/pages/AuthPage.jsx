import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { register, login } from "../utils/api";
import { generateKeyPair, hasKeyPair } from "../utils/crypto";

export default function AuthPage() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const tabBtn = (m) => ({
    flex:1, padding:"8px", border:"none", borderRadius:"6px",
    background: mode===m ? "#111318" : "transparent",
    color: mode===m ? "#e2e4ea" : "#7c8096",
    cursor:"pointer", fontSize:"13px", fontWeight:500
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        setStatus("Generating encryption keys…");
        const { publicKeyBase64 } = await generateKeyPair(username);
        setStatus("Creating account…");
        const res = await register(username, password, publicKeyBase64);
        const access_token = res.data.access_token || res.data.token;
        const user = res.data.user || { username };
        signIn(user, access_token);
      } else {
        setStatus("Authenticating…");
        const res = await login(username, password);
        const access_token = res.data.access_token || res.data.token;
        const user = res.data.user || { username };
        const hasKeys = await hasKeyPair(username);
        if (!hasKeys) {
          setError("No keys found on this device. Please register again.");
          setLoading(false);
          setStatus("");
          return;
        }
        signIn(user, access_token);
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
const errorMsg = Array.isArray(detail) ? detail[0]?.msg || "Validation error" : (typeof detail === "string" ? detail : err.message || "Something went wrong");
setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", minWidth:"100vw", background:"#0a0c10", padding:"24px", boxSizing:"border-box" }}>
      <div style={{ width:"100%", maxWidth:"400px", background:"#111318", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"20px", padding:"36px", boxSizing:"border-box" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"14px", marginBottom:"28px" }}>
          <div style={{ width:"48px", height:"48px", borderRadius:"14px", background:"linear-gradient(135deg,#00d4aa,#00896e)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:"22px" }}>🔒</div>
          <div>
            <h1 style={{ fontSize:"22px", fontWeight:700, color:"#e2e4ea", margin:0 }}>WhisperBox</h1>
            <p style={{ fontSize:"11px", color:"#7c8096", margin:0 }}>End-to-end encrypted messaging</p>
          </div>
        </div>
        <div style={{ display:"flex", background:"#181b22", borderRadius:"8px", padding:"3px", marginBottom:"24px", gap:"3px" }}>
          <button style={tabBtn("login")} onClick={() => { setMode("login"); setError(""); }}>Sign In</button>
          <button style={tabBtn("register")} onClick={() => { setMode("register"); setError(""); }}>Create Account</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
            <label style={{ fontSize:"11px", fontWeight:600, color:"#7c8096", textTransform:"uppercase", letterSpacing:"0.04em" }}>Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. priscy" required disabled={loading}
              style={{ padding:"10px 14px", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"8px", background:"#181b22", color:"#e2e4ea", fontSize:"14px", outline:"none", boxSizing:"border-box", width:"100%" }} />
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
            <label style={{ fontSize:"11px", fontWeight:600, color:"#7c8096", textTransform:"uppercase", letterSpacing:"0.04em" }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required disabled={loading}
              style={{ padding:"10px 14px", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"8px", background:"#181b22", color:"#e2e4ea", fontSize:"14px", outline:"none", boxSizing:"border-box", width:"100%" }} />
          </div>
          {error && <div style={{ padding:"10px 14px", borderRadius:"8px", background:"rgba(255,92,92,0.1)", border:"1px solid rgba(255,92,92,0.2)", color:"#ff5c5c", fontSize:"13px" }}>{error}</div>}
          {status && <div style={{ display:"flex", alignItems:"center", gap:"8px", fontSize:"13px", color:"#00d4aa" }}><span style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#00d4aa", display:"inline-block" }}></span>{status}</div>}
          <button type="submit" disabled={loading}
            style={{ padding:"12px", border:"none", borderRadius:"8px", background:"linear-gradient(135deg,#00d4aa,#00a882)", color:"#000", fontSize:"14px", fontWeight:700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, width:"100%" }}>
            {loading ? "Please wait…" : mode === "register" ? "Create Account & Generate Keys" : "Sign In"}
          </button>
        </form>
        <p style={{ marginTop:"16px", fontSize:"11px", color:"#454858", textAlign:"center" }}>
          {mode === "register" ? "🔒 Private key generated locally — never sent to servers." : "🔒 Messages decrypted only on your device."}
        </p>
      </div>
    </div>
  );
}
