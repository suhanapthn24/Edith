"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const AUTO_LOCK_MS = 5 * 60 * 1000; // 5 minutes after face leaves frame

export interface EnrollmentStatus {
  face: boolean;
  voice: boolean;
}

export type AuthState = "checking" | "unenrolled" | "locked" | "authenticated";

interface AuthContextValue {
  state: AuthState;
  enrollment: EnrollmentStatus | null;
  storedFaceEmbedding: number[] | null;
  authenticate: (method: "face" | "voice") => void;
  lock: () => void;
  resetAutoLock: () => void;
  refreshStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>("checking");
  const [enrollment, setEnrollment] = useState<EnrollmentStatus | null>(null);
  const [storedFaceEmbedding, setStoredFaceEmbedding] = useState<number[] | null>(null);
  const autoLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/biometric/status`);
      if (!res.ok) { setState("locked"); return; }
      const data: EnrollmentStatus = await res.json();
      setEnrollment(data);

      if (!data.face && !data.voice) {
        setState("unenrolled");
        return;
      }

      if (data.face) {
        try {
          const r = await fetch(`${API_BASE}/api/v1/auth/biometric/face-embedding`);
          if (r.ok) {
            const d = await r.json();
            setStoredFaceEmbedding(d.embedding);
          }
        } catch {}
      }

      setState("locked");
    } catch {
      setState("locked");
    }
  }, []);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  const resetAutoLock = useCallback(() => {
    if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current);
    autoLockTimerRef.current = setTimeout(() => setState("locked"), AUTO_LOCK_MS);
  }, []);

  const authenticate = useCallback((method: "face" | "voice") => {
    setState("authenticated");
    resetAutoLock();
    // eslint-disable-next-line no-console
    console.log(`[EDITH Auth] Authenticated via ${method}`);
  }, [resetAutoLock]);

  const lock = useCallback(() => {
    if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current);
    setState("locked");
  }, []);

  return (
    <AuthContext.Provider
      value={{ state, enrollment, storedFaceEmbedding, authenticate, lock, resetAutoLock, refreshStatus }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
