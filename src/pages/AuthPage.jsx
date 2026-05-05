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
        const { access_token, user } = res.data;
        signIn(user, access_token);
      } else {
        setStatus("Authenticating…");
        const res = await login(username, password);
        const { access_token, user } = res.data;
        const hasKeys = await hasKeyPair(username);
        if (!hasKeys) {
          setError("No encryption keys found on this device. Please register again or use the device you registered on.");
          setLoading(false);
          setStatus("");
          return;
        }
        signIn(user, access_token);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Something went wrong");
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-mark">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <h1>WhisperBox</h1>
            <p className="auth-tagline">End-to-end encrypted messaging</p>
          </div>
        </div>

        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign In</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Create Account</button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. priscy"
              required
              autoComplete="username"
              disabled={loading}
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              disabled={loading}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}
          {status && <div className="auth-status"><span className="status-dot" />{status}</div>}

          <button type="submit" className="btn-auth" disabled={loading}>
            {loading ? "Please wait…" : mode === "register" ? "Create Account & Generate Keys" : "Sign In"}
          </button>
        </form>

        <div className="auth-note">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          {mode === "register"
            ? "Your private key is generated locally and never sent to our servers."
            : "Messages are decrypted only on your device."}
        </div>
      </div>
    </div>
  );
}
