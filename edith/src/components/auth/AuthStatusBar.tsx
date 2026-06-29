"use client";

import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const VOICE_RECORD_MS = 4000;

export function AuthStatusBar() {
  const { state, enrollment, lock } = useAuth();
  const { authenticate } = useAuth();
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "recording" | "verifying">("idle");
  const [voiceResult, setVoiceResult] = useState<"ok" | "fail" | null>(null);

  const recordVoiceAuth = useCallback(async () => {
    if (!enrollment?.voice || voiceStatus !== "idle") return;
    setVoiceStatus("recording");
    setVoiceResult(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setVoiceStatus("idle");
      return;
    }

    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.start(100);

    await new Promise<void>((res) => setTimeout(res, VOICE_RECORD_MS));
    recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
    await new Promise<void>((res) => { recorder.onstop = () => res(); });

    setVoiceStatus("verifying");
    const blob = new Blob(chunks, { type: "audio/webm" });
    const form = new FormData();
    form.append("audio", blob, "auth.webm");

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/biometric/verify/voice`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (data.verified) {
        setVoiceResult("ok");
        authenticate("voice");
      } else {
        setVoiceResult("fail");
        setTimeout(() => setVoiceResult(null), 3000);
      }
    } catch {
      setVoiceResult("fail");
      setTimeout(() => setVoiceResult(null), 3000);
    } finally {
      setVoiceStatus("idle");
    }
  }, [enrollment, voiceStatus, authenticate]);

  // Don't show anything when authenticated or still checking
  if (state === "authenticated" || state === "checking") return null;

  return (
    <div
      className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-5"
      style={{
        height: 36,
        background: "rgba(13, 9, 6, 0.92)",
        borderBottom: "1px solid rgba(255,241,181,0.08)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Left: status */}
      <div className="flex items-center gap-2.5">
        {/* Pulsing dot */}
        <span className="relative flex h-1.5 w-1.5">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
            style={{ background: "#FFF1B5" }}
          />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: "#FFF1B5" }} />
        </span>
        <span className="text-[10px] font-mono tracking-widest text-[#FFF1B5]/40 uppercase">
          {voiceResult === "fail"
            ? "Voice not recognized"
            : voiceStatus === "recording"
            ? "Recording voice..."
            : voiceStatus === "verifying"
            ? "Verifying..."
            : "Scanning for identity"}
        </span>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-3">
        {/* Voice auth button (only if voice enrolled) */}
        {enrollment?.voice && voiceStatus === "idle" && (
          <button
            onClick={recordVoiceAuth}
            title="Verify by voice"
            className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-[#FFF1B5]/30 hover:text-[#FFF1B5]/60 transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <line x1="12" y1="19" x2="12" y2="23" />
            </svg>
            VOICE
          </button>
        )}

        {/* Voice result indicator */}
        {voiceResult === "ok" && (
          <span className="text-[10px] font-mono text-green-400/70">✓ verified</span>
        )}
        {voiceResult === "fail" && (
          <span className="text-[10px] font-mono text-red-400/70">✗ no match</span>
        )}

        {/* Lock button (for testing / manual lock) */}
        <button
          onClick={lock}
          title="Lock EDITH"
          className="text-[10px] font-mono tracking-widest text-[#FFF1B5]/20 hover:text-[#FFF1B5]/50 transition-colors"
        >
          LOCK
        </button>
      </div>
    </div>
  );
}
