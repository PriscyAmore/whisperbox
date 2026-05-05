import { createContext, useContext, useState, useEffect } from "react";
import { getProfile } from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("wb_token");
    if (token) {
      getProfile()
        .then((res) => {
          const userData = res.data;
          localStorage.setItem("wb_user", JSON.stringify(userData));
          setUser(userData);
        })
        .catch(() => {
          localStorage.removeItem("wb_token");
          localStorage.removeItem("wb_user");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
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
