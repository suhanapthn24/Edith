"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Globe, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function Navbar() {
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const { state: authState, lock } = useAuth();

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/auth/google/status`)
      .then((r) => r.json())
      .then((d) => setGoogleConnected(d.connected))
      .catch(() => setGoogleConnected(false));

    const params = new URLSearchParams(window.location.search);
    if (params.get("google") === "connected") {
      setGoogleConnected(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-6"
      style={{
        background: "rgba(24, 15, 11, 0.95)",
        borderBottom: "1px solid rgba(255, 241, 181, 0.08)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2.5 select-none">
        <Image
          src="/logo.png"
          alt="EDITH"
          width={28}
          height={28}
          style={{ width: 28, height: 28 }}
          className="rounded-lg object-contain"
          priority
        />
        <span
          className="text-xl font-light tracking-[0.2em] text-[#FFF1B5]"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          EDITH
        </span>
      </Link>

      {/* Google connection status */}
      {googleConnected === false && (
        <a
          href={`${API_BASE}/api/v1/auth/google`}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#FFF1B5]/10 text-xs text-[#FFF1B5]/35 hover:text-[#FFF1B5]/60 hover:border-[#FFF1B5]/20 transition-colors"
        >
          <Globe size={13} />
          Connect Google
        </a>
      )}

      {googleConnected === true && (
        <div className="flex items-center gap-1.5 text-xs text-[#C1DBE8]/60 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C1DBE8]" />
          Google connected
        </div>
      )}

      {/* Biometric auth status + manual lock */}
      <div className="flex items-center gap-3 ml-3">
        {authState === "authenticated" && (
          <button
            onClick={lock}
            title="Lock EDITH"
            className="flex items-center gap-1.5 text-xs text-[#FFF1B5]/25 hover:text-[#FFF1B5]/60 transition-colors font-mono"
          >
            <Lock size={12} />
          </button>
        )}
        {authState === "locked" && (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ background: "#FFF1B5" }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: "#FFF1B5" }} />
            </span>
            <span className="text-[10px] font-mono tracking-widest text-[#FFF1B5]/30 uppercase">Scanning</span>
          </div>
        )}
      </div>
    </nav>
  );
}
