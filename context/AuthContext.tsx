"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  updateProfile,
  type User,
  type Auth,
} from "firebase/auth";
import { app, firebaseEnabled } from "@/lib/firebase/client";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  displayName: string;
  setDisplayName: (name: string) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth: Auth | null = useMemo(() => {
    if (!firebaseEnabled || !app) return null;
    return getAuth(app);
  }, [firebaseEnabled]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayNameState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("displayName") || "";
    }
    return "";
  });

  const setDisplayName = (name: string) => {
    setDisplayNameState(name);
    if (typeof window !== "undefined") {
      localStorage.setItem("displayName", name);
    }
    if (auth && auth.currentUser) {
      updateProfile(auth.currentUser, { displayName: name }).catch(() => void 0);
    }
  };

  useEffect(() => {
    if (!firebaseEnabled || !auth) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, [auth]);

  useEffect(() => {
    if (!firebaseEnabled || !auth) return;
    if (!user) {
      signInAnonymously(auth).catch(() => void 0);
    }
  }, [auth, user]);

  const value: AuthContextValue = { user, loading, displayName, setDisplayName };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
