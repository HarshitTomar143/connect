"use client";

import { createContext, useContext, useState, useEffect } from "react";
import API from "../lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await API.get("/auth/profile");
          setUser(res.data);
          
        const saved = localStorage.getItem("token");
        if (saved) setToken(saved);
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const login = async (email, password) => {
    const res = await API.post("/auth/login", { email, password });
    setUser(res.data);
    setToken(res.data.token);
    localStorage.setItem("token", res.data.token);
    return res.data;
  };

  const register = async (displayName, email, password) => {
    const res = await API.post("/auth/register", { displayName, email, password });
    setUser(res.data);
    setToken(res.data.token);
    localStorage.setItem("token", res.data.token);
    return res.data;
  };

  const updateProfile = async (payload) => {
    const res = await API.put("/auth/profile", payload);
    setUser(res.data);
    return res.data;
  };

  const logout = async () => {
    await API.post("/auth/logout");
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
