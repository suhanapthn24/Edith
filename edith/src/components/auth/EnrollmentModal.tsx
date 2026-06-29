"use client";

import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const MODELS_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@0.22.2/weights";
const CAPTURE_FRAMES = 5;
const VOICE_RECORD_MS = 5000;

type Step = "welcome" | "face-setup" | "face-capture" | "voice-setup" | "voice-record" | "done";

export function EnrollmentModal() {
  const { refreshStatus } = useAuth();
  const [step, setStep] = useState<Step>("welcome");
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      return true;
    } catch {
      setStatus("Camera access denied. Allow camera and try again.");
      return false;
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const captureFace = useCallback(async () => {
    setStep("face-capture");
    setStatus("Loading face recognition models...");
    const ok = await startCamera();
    if (!ok) return;

    const faceapi = await import("@vladmandic/face-api");
    setStatus("Loading models from CDN (first time only)...");
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
    ]);

    // Wait for video to be ready
    await new Promise<void>((res) => setTimeout(res, 1000));

    const descriptors: number[][] = [];
    setStatus("Look straight at the camera...");

    for (let i = 0; i < CAPTURE_FRAMES; i++) {
      setProgress(Math.round((i / CAPTURE_FRAMES) * 100));
      setStatus(`Capturing frame ${i + 1} of ${CAPTURE_FRAMES}...`);

      await new Promise<void>((res) => setTimeout(res, 600));

      if (!videoRef.current) break;
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (!detection) {
        setStatus(`No face detected on frame ${i + 1}. Please look at the camera.`);
        i--; // retry
        await new Promise<void>((res) => setTimeout(res, 800));
        continue;
      }
      descriptors.push(Array.from(detection.descriptor));
    }

    setProgress(100);

    // Average the descriptors
    const avg = descriptors[0].map((_, j) =>
      descriptors.reduce((sum, d) => sum + d[j], 0) / descriptors.length
    );

    setStatus("Saving face profile...");
    const res = await fetch(`${API_BASE}/api/v1/auth/biometric/enroll/face`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embedding: avg }),
    });

    stopCamera();

    if (!res.ok) {
      setStatus("Failed to save face profile. Try again.");
      return;
    }

    setStep("voice-setup");
    setStatus("");
    setProgress(0);
  }, [startCamera, stopCamera]);

  const recordVoice = useCallback(async () => {
    setStep("voice-record");
    setStatus("Starting microphone...");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setStatus("Microphone access denied.");
      return;
    }

    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    recorder.start(100);
    setStatus('Recording... say: "Hey Edith, access granted — I am your creator."');

    let elapsed = 0;
    const tick = setInterval(() => {
      elapsed += 200;
      setProgress(Math.round((elapsed / VOICE_RECORD_MS) * 100));
      if (elapsed >= VOICE_RECORD_MS) clearInterval(tick);
    }, 200);

    await new Promise<void>((res) => setTimeout(res, VOICE_RECORD_MS));
    clearInterval(tick);
    recorder.stop();
    stream.getTracks().forEach((t) => t.stop());

    await new Promise<void>((res) => { recorder.onstop = () => res(); });

    setProgress(100);
    setStatus("Saving voice profile...");

    const blob = new Blob(chunks, { type: "audio/webm" });
    const form = new FormData();
    form.append("audio", blob, "voice.webm");

    const res = await fetch(`${API_BASE}/api/v1/auth/biometric/enroll/voice`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      setStatus("Voice enrollment failed. Make sure resemblyzer or librosa is installed on the backend.");
      return;
    }

    setStep("done");
    await refreshStatus();
  }, [refreshStatus]);

  const skipVoice = useCallback(async () => {
    setStep("done");
    await refreshStatus();
  }, [refreshStatus]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(8, 6, 4, 0.97)", backdropFilter: "blur(24px)" }}
    >
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl p-8 flex flex-col gap-6"
        style={{ background: "#0D0906", border: "1px solid rgba(255,241,181,0.12)" }}
      >
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h2
            className="text-2xl font-light tracking-[0.15em] text-[#FFF1B5]"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            EDITH Security Setup
          </h2>
          <p className="text-xs text-[#FFF1B5]/40 font-mono tracking-wide">
            Biometric access — your data never leaves this device
          </p>
        </div>

        {/* Step: Welcome */}
        {step === "welcome" && (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-[#FFF1B5]/60 leading-relaxed">
              EDITH will only respond to <span className="text-[#FFF1B5]/90">you</span>. Set up face
              recognition so the system auto-unlocks when you sit down, and optionally add voice
              verification as a backup.
            </p>
            <div className="flex flex-col gap-2 text-xs text-[#FFF1B5]/40 font-mono">
              <div className="flex items-center gap-2"><span className="text-[#FFF1B5]/70">01</span> Face scan (passive, webcam)</div>
              <div className="flex items-center gap-2"><span className="text-[#FFF1B5]/70">02</span> Voice passphrase (optional fallback)</div>
            </div>
            <button
              onClick={captureFace}
              className="w-full py-3 rounded-xl text-sm font-mono tracking-widest transition-all"
              style={{
                background: "rgba(255,241,181,0.08)",
                border: "1px solid rgba(255,241,181,0.2)",
                color: "#FFF1B5",
              }}
            >
              BEGIN SETUP
            </button>
          </div>
        )}

        {/* Step: Face capture */}
        {(step === "face-setup" || step === "face-capture") && (
          <div className="flex flex-col gap-4 items-center">
            <div
              className="relative rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(255,241,181,0.15)", background: "#080604" }}
            >
              <video
                ref={videoRef}
                muted
                playsInline
                className="w-full rounded-xl"
                style={{ maxHeight: 200, objectFit: "cover" }}
              />
              {/* Scanning overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div
                  className="absolute left-4 top-4 w-6 h-6"
                  style={{ borderTop: "2px solid #FFF1B5", borderLeft: "2px solid #FFF1B5", opacity: 0.6 }}
                />
                <div
                  className="absolute right-4 top-4 w-6 h-6"
                  style={{ borderTop: "2px solid #FFF1B5", borderRight: "2px solid #FFF1B5", opacity: 0.6 }}
                />
                <div
                  className="absolute left-4 bottom-4 w-6 h-6"
                  style={{ borderBottom: "2px solid #FFF1B5", borderLeft: "2px solid #FFF1B5", opacity: 0.6 }}
                />
                <div
                  className="absolute right-4 bottom-4 w-6 h-6"
                  style={{ borderBottom: "2px solid #FFF1B5", borderRight: "2px solid #FFF1B5", opacity: 0.6 }}
                />
              </div>
            </div>

            {status && <p className="text-xs text-[#FFF1B5]/60 font-mono text-center">{status}</p>}

            {progress > 0 && (
              <div className="w-full h-0.5 rounded-full bg-[#FFF1B5]/10">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, background: "#FFF1B5" }}
                />
              </div>
            )}
          </div>
        )}

        {/* Step: Voice setup */}
        {step === "voice-setup" && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2 text-xs font-mono text-[#C1DBE8]/70">
              <span className="w-2 h-2 rounded-full bg-green-400/70" />
              Face profile saved
            </div>
            <p className="text-sm text-[#FFF1B5]/60 leading-relaxed">
              Add voice verification as a fallback — say a passphrase to unlock EDITH when the camera
              isn&apos;t available.
            </p>
            <p
              className="text-xs font-mono text-[#FFF1B5]/30 text-center py-2 px-3 rounded-lg"
              style={{ background: "rgba(255,241,181,0.04)", border: "1px solid rgba(255,241,181,0.06)" }}
            >
              &quot;Hey Edith, access granted — I am your creator.&quot;
            </p>
            <div className="flex gap-3">
              <button
                onClick={recordVoice}
                className="flex-1 py-3 rounded-xl text-sm font-mono tracking-widest transition-all"
                style={{
                  background: "rgba(255,241,181,0.08)",
                  border: "1px solid rgba(255,241,181,0.2)",
                  color: "#FFF1B5",
                }}
              >
                RECORD VOICE
              </button>
              <button
                onClick={skipVoice}
                className="px-5 py-3 rounded-xl text-sm font-mono tracking-widest transition-all"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,241,181,0.08)",
                  color: "#FFF1B5",
                  opacity: 0.4,
                }}
              >
                SKIP
              </button>
            </div>
          </div>
        )}

        {/* Step: Voice recording */}
        {step === "voice-record" && (
          <div className="flex flex-col gap-4 items-center">
            {/* Animated mic */}
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-full animate-ping"
                style={{ background: "rgba(255,241,181,0.08)" }}
              />
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,241,181,0.12)", border: "1px solid rgba(255,241,181,0.3)" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFF1B5" strokeWidth="1.5">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </div>
            </div>
            {status && <p className="text-xs text-[#FFF1B5]/60 font-mono text-center">{status}</p>}
            {progress > 0 && (
              <div className="w-full h-0.5 rounded-full bg-[#FFF1B5]/10">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, background: "#FFF1B5" }}
                />
              </div>
            )}
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="flex flex-col gap-4 items-center text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,241,181,0.08)", border: "1px solid rgba(255,241,181,0.2)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFF1B5" strokeWidth="1.5">
                <polyline points="20,6 9,17 4,12" />
              </svg>
            </div>
            <p className="text-sm text-[#FFF1B5]/60">
              Biometric access configured. EDITH will auto-unlock when it sees your face.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
