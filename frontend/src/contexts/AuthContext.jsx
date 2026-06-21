import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("aeri_token");
    const email = localStorage.getItem("aeri_email");
    if (token && email) {
      api
        .get("/auth/me")
        .then((r) => setUser({ email: r.data.email, role: r.data.role }))
        .catch(() => setUser(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("aeri_token", res.data.token);
    localStorage.setItem("aeri_email", res.data.email);
    localStorage.setItem("aeri_role", res.data.role);
    setUser({ email: res.data.email, role: res.data.role });
  };

  const logout = () => {
    localStorage.removeItem("aeri_token");
    localStorage.removeItem("aeri_email");
    localStorage.removeItem("aeri_role");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
