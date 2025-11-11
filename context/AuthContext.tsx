"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  }, []);
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

  const signInRetryRef = useRef(0);
  const signInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
    }
    return undefined;
  }, [auth]);

  useEffect(() => {
    if (!auth) return undefined;
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        signInRetryRef.current = 0;
        if (signInTimerRef.current) {
          clearTimeout(signInTimerRef.current);
          signInTimerRef.current = null;
        }
        setLoading(false);
      }
    });
    return () => {
      unsub();
    };
  }, [auth]);

  useEffect(() => {
    if (!auth || user) return undefined;

    setLoading(true);

    let cancelled = false;

    const scheduleNext = (delay: number) => {
      if (cancelled) return;
      if (signInTimerRef.current) {
        clearTimeout(signInTimerRef.current);
        signInTimerRef.current = null;
      }
      signInTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        signInAnonymously(auth)
          .then(() => {
            signInRetryRef.current = 0;
            // 成功時は onAuthStateChanged 側で loading を解除
          })
          .catch(() => {
            const nextAttempt = signInRetryRef.current + 1;
            signInRetryRef.current = nextAttempt;
            if (nextAttempt >= 5) {
              setLoading(false);
              return;
            }
            const delayMs = Math.min(500 * Math.pow(2, nextAttempt - 1), 5000);
            scheduleNext(delayMs);
          });
      }, delay);
    };

    // 初回は即時実行
    scheduleNext(0);

    return () => {
      cancelled = true;
      if (signInTimerRef.current) {
        clearTimeout(signInTimerRef.current);
        signInTimerRef.current = null;
      }
    };
  }, [auth, user]);

  useEffect(() => {
    if (!user?.displayName) return;
    setDisplayNameState((current) => {
      if (current && current.trim().length > 0) {
        return current;
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("displayName", user.displayName ?? "");
      }
      return user.displayName ?? "";
    });
  }, [user?.displayName]);

  const value: AuthContextValue = { user, loading, displayName, setDisplayName };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
