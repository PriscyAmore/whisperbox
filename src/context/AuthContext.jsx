import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("wb_token");
    const savedUser = localStorage.getItem("wb_user");
    if (token && savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch {}
    }
    setLoading(false);
  }, []);

  const signIn = (userData, token) => {
    localStorage.setItem("wb_token", token);
    localStorage.setItem("wb_user", JSON.stringify(userData));
    setUser(userData);
  };

  const signOut = () => {
    localStorage.removeItem("wb_token");
    localStorage.removeItem("wb_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
