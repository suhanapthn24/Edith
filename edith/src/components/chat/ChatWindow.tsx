"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Mic, MicOff, Volume2, VolumeX, Zap, X, Radio, MapPin, MapPinOff } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const SESSION_ID = "EDITH-default";

type Role = "user" | "assistant";

interface Message {
  id: string;
  role: Role;
  content: string;
  tools?: string[];
  streaming?: boolean;
}

const SUGGESTIONS = [
  "What tasks do I have today?",
  "Remind me to call Mom at 6 PM",
  "Schedule a meeting tomorrow at 3 PM",
  "What's on my calendar this week?",
  "Search my notes for project ideas",
  "What should I work on next?",
];

// ── Web Speech API types ───────────────────────────────────────────────────────

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onend: (() => void) | null;
    onerror: ((event: Event) => void) | null;
  }
  interface SpeechRecognitionEvent extends Event {
    readonly results: SpeechRecognitionResultList;
  }
}

// ── Wake word helpers ──────────────────────────────────────────────────────────

function isWakeWord(text: string): boolean {
  const t = text.toLowerCase().trim();
  // "edith" and common mishearings
  if (t.includes("edith")) return true;
  if ((t.includes("hey") || t.includes("hi") || t.includes("ok")) && (t.includes("edit") || t.includes("edie"))) return true;
  // Standalone wake phrases
  if (t === "hey" || t.startsWith("hey ")) return true;
  if (t === "listen" || t.startsWith("listen ")) return true;
  if (t.includes("wake up")) return true;
  if (t.includes("wakey")) return true;
  return false;
}

function isStopWord(text: string): boolean {
  return /\b(stop|shut up|quiet|enough|silence|stop talking|ok stop|that'?s enough)\b/i.test(text);
}

function stripWakeWord(text: string): string {
  return text
    .replace(/^(hey\s+(edith?|edit|edie)|edith?\s*(are you there)?|wake\s*up(\s*(pal|buddy|edith?))?|wakey\s*wakey(\s+edith?)?|yo\s+edith?|ok(ay)?\s+edith?|alright\s+edith?|listen(\s+up)?(\s+edith?)?|hey)\s*/i, "")
    .trim();
}

function playActivationTone() {
  try {
    const ctx = new AudioContext();
    [440, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.13 + 0.18);
      osc.start(ctx.currentTime + i * 0.13);
      osc.stop(ctx.currentTime + i * 0.13 + 0.18);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        'Hey — I\'m EDITH, your personal assistant. Tell me what you need: tasks, reminders, calendar, or search your notes. I can hear you too — tap the mic or say "Hey EDITH".',
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>([]);

  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [wakeMode, setWakeMode] = useState(true);
  const [isWakeActive, setIsWakeActive] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const commandRecRef = useRef<SpeechRecognition | null>(null);
  const wakeRecRef = useRef<SpeechRecognition | null>(null);
  const stopRecRef = useRef<SpeechRecognition | null>(null);

  const wakeModeRef = useRef(false);
  const voiceEnabledRef = useRef(false);
  const loadingRef = useRef(false);
  const wakeEndReasonRef = useRef<"wake" | "stop" | "natural">("natural");

  useEffect(() => { wakeModeRef.current = wakeMode; }, [wakeMode]);
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSpeechSupported(
      typeof window !== "undefined" &&
        ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    );
  }, []);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocationDenied(false);
      },
      () => setLocationDenied(true)
    );
  }, []);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTools]);

  const startWakeListeningRef = useRef<(() => void) | null>(null);
  const sendRef = useRef<((text: string) => void) | null>(null);

  const speak = useCallback((text: string) => {
    if (!voiceEnabledRef.current || typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[•*#`[\]]/g, "").replace(/\n+/g, ". ").trim();
    if (!clean) return;
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => /Hazel/i.test(v.name)) ??
      voices.find((v) => /Libby|Maisie|Ryan|George|Google UK English Female|Google UK English Male/i.test(v.name)) ??
      voices.find((v) => v.lang === "en-GB") ??
      voices.find((v) => v.lang.startsWith("en") && v.localService) ??
      voices.find((v) => v.lang.startsWith("en"));
    if (preferred) utterance.voice = preferred;

    const stopStopListener = () => {
      if (stopRecRef.current) {
        stopRecRef.current.onend = null;
        stopRecRef.current.onresult = null;
        try { stopRecRef.current.stop(); } catch {}
        stopRecRef.current = null;
      }
    };

    const startStopListener = () => {
      if (!speechSupported || stopRecRef.current) return;
      const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results).map((r) => r[0].transcript).join(" ");
        if (isStopWord(transcript)) {
          window.speechSynthesis.cancel();
          stopStopListener();
          if (wakeModeRef.current) setTimeout(() => startWakeListeningRef.current?.(), 400);
        }
      };

      rec.onend = () => {
        if (stopRecRef.current === rec) stopRecRef.current = null;
        // restart if still speaking
        if (window.speechSynthesis.speaking) startStopListener();
      };

      rec.onerror = () => {
        if (stopRecRef.current === rec) stopRecRef.current = null;
      };

      stopRecRef.current = rec;
      try { rec.start(); } catch {}
    };

    utterance.onstart = () => startStopListener();

    utterance.onend = () => {
      stopStopListener();
      if (wakeModeRef.current) setTimeout(() => startWakeListeningRef.current?.(), 500);
    };

    window.speechSynthesis.speak(utterance);
  }, [speechSupported]);

  const startCommandListening = useCallback(() => {
    if (!speechSupported) return;
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    let transcript = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      transcript = (final || interim).trim();
      setInput(transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
      commandRecRef.current = null;
      const cleaned = stripWakeWord(transcript).trim();
      if (cleaned) {
        setTimeout(() => sendRef.current?.(cleaned), 100);
      } else if (wakeModeRef.current) {
        setTimeout(() => startWakeListeningRef.current?.(), 500);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      commandRecRef.current = null;
      if (wakeModeRef.current) setTimeout(() => startWakeListeningRef.current?.(), 1000);
    };

    commandRecRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [speechSupported]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (loadingRef.current) {
        if (wakeModeRef.current) setTimeout(() => startWakeListeningRef.current?.(), 500);
        return;
      }

      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed };
      const assistantId = crypto.randomUUID();
      const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", tools: [], streaming: true };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch(`${API_BASE}/api/v1/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, session_id: SESSION_ID, ...coords }),
        });

        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const evt = JSON.parse(line.slice(6));

              if (evt.type === "token") {
                finalText += evt.content;
                setMessages((prev) =>
                  prev.map((m) => m.id === assistantId ? { ...m, content: m.content + evt.content } : m)
                );
              } else if (evt.type === "tool_start") {
                const toolName = evt.tool as string;
                const toolInput = (evt.input ?? {}) as Record<string, string>;

                if (toolName === "search_youtube" && toolInput.query) {
                  window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(toolInput.query)}`, "_blank");
                } else if (toolName === "open_url" && toolInput.url) {
                  window.open(toolInput.url, "_blank");
                } else if (toolName === "search_web" && toolInput.query) {
                  window.open(`https://www.google.com/search?q=${encodeURIComponent(toolInput.query)}`, "_blank");
                } else if (toolName === "search_maps" && toolInput.query) {
                  window.open(`https://www.google.com/maps/search/${encodeURIComponent(toolInput.query)}`, "_blank");
                } else if (toolName === "call_contact" && toolInput.name) {
                  // number resolved by backend; frontend opens dialer when tool result comes in
                } else if (toolName === "message_contact" && toolInput.name) {
                  // number resolved by backend; frontend opens SMS when tool result comes in
                }

                setActiveTools((t) => [...t, toolName]);
                setMessages((prev) =>
                  prev.map((m) => m.id === assistantId ? { ...m, tools: [...(m.tools ?? []), toolName] } : m)
                );
              } else if (evt.type === "tool_end") {
                const endTool = evt.tool as string;
                const output = (evt.output ?? "") as string;
                const phoneMatch = output.match(/[\+\d][\d\s\-\(\)]{6,}/);
                if (phoneMatch) {
                  const number = phoneMatch[0].replace(/[\s\-\(\)]/g, "");
                  if (endTool === "call_contact") {
                    window.location.href = `tel:${number}`;
                  } else if (endTool === "message_contact") {
                    window.location.href = `sms:${number}`;
                  }
                }
                setActiveTools((t) => t.slice(1));
              } else if (evt.type === "done") {
                setMessages((prev) =>
                  prev.map((m) => m.id === assistantId ? { ...m, streaming: false } : m)
                );
                speak(cleanContent(finalText));
                if (!voiceEnabledRef.current && wakeModeRef.current) {
                  setTimeout(() => startWakeListeningRef.current?.(), 500);
                }
              } else if (evt.type === "error") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: `Error: ${evt.content}`, streaming: false } : m
                  )
                );
                if (wakeModeRef.current) setTimeout(() => startWakeListeningRef.current?.(), 500);
              }
            } catch {}
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `Connection failed: ${msg}. Make sure the backend is running on port 8000.`, streaming: false }
              : m
          )
        );
        if (wakeModeRef.current) setTimeout(() => startWakeListeningRef.current?.(), 500);
      } finally {
        setLoading(false);
        setActiveTools([]);
        inputRef.current?.focus();
      }
    },
    [speak]
  );

  useEffect(() => { sendRef.current = send; }, [send]);

  const startWakeListening = useCallback(() => {
    if (!speechSupported || !wakeModeRef.current) return;
    if (wakeRecRef.current || commandRecRef.current) return;

    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    wakeEndReasonRef.current = "natural";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (wakeEndReasonRef.current === "wake") return;

      const trigger = () => {
        wakeEndReasonRef.current = "wake";
        recognition.stop();
        wakeRecRef.current = null;
        setIsWakeActive(false);
        playActivationTone();
        setTimeout(() => startCommandListening(), 400);
      };

      // Check combined last-4 results — catches "hey" / "edith" split across chunks
      const len = event.results.length;
      const combined = Array.from(
        { length: Math.min(4, len) },
        (_, k) => event.results[len - Math.min(4, len) + k][0].transcript
      ).join(" ").trim();
      if (isWakeWord(combined)) { trigger(); return; }

      // Also check each new individual result
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (isWakeWord(event.results[i][0].transcript.trim())) { trigger(); return; }
      }
    };

    recognition.onend = () => {
      const reason = wakeEndReasonRef.current;
      wakeEndReasonRef.current = "natural";
      wakeRecRef.current = null;
      setIsWakeActive(false);
      if (reason === "natural" && wakeModeRef.current && !commandRecRef.current) {
        setTimeout(() => startWakeListeningRef.current?.(), 400);
      }
    };

    recognition.onerror = () => {
      wakeRecRef.current = null;
      setIsWakeActive(false);
      if (wakeModeRef.current && !commandRecRef.current) setTimeout(() => startWakeListeningRef.current?.(), 1000);
    };

    wakeRecRef.current = recognition;
    recognition.start();
    setIsWakeActive(true);
  }, [speechSupported, startCommandListening]);

  useEffect(() => { startWakeListeningRef.current = startWakeListening; }, [startWakeListening]);

  useEffect(() => {
    if (wakeMode) {
      startWakeListening();
    } else {
      wakeEndReasonRef.current = "stop";
      wakeRecRef.current?.stop();
      wakeRecRef.current = null;
      setIsWakeActive(false);
    }
  }, [wakeMode, startWakeListening]);

  const startListening = useCallback(() => {
    if (!speechSupported || isListening) return;
    wakeEndReasonRef.current = "stop";
    wakeRecRef.current?.stop();
    wakeRecRef.current = null;
    setIsWakeActive(false);
    startCommandListening();
  }, [speechSupported, isListening, startCommandListening]);

  const stopListening = useCallback(() => {
    commandRecRef.current?.stop();
    setIsListening(false);
  }, []);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const clearChat = async () => {
    window.speechSynthesis?.cancel();
    await fetch(`${API_BASE}/api/v1/chat/clear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: SESSION_ID }),
    }).catch(() => {});
    setMessages([{ id: "welcome", role: "assistant", content: "Cleared. What do you need?" }]);
  };

  return (
    <div className="flex flex-col h-full">

      {/* ── Chat header ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-6 py-3.5"
        style={{ borderBottom: "1px solid rgba(255,241,181,0.07)" }}
      >
        <div className="flex items-center gap-3">
          <Zap size={15} className="text-[#FFF1B5]/60" />
          <span
            className="font-semibold tracking-[0.18em] text-[#FFF1B5]/80 text-[13px] uppercase"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            EDITH
          </span>
          <span className="text-[10px] text-[#FFF1B5]/18 font-mono">
            {process.env.NEXT_PUBLIC_MODEL_LABEL ?? "gemini-2.5-flash"}
          </span>

          {isWakeActive && !isListening && (
            <span className="flex items-center gap-1.5 text-[10px] text-[#C1DBE8]/60 font-mono ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C1DBE8]/70 animate-pulse" />
              listening
            </span>
          )}
          {isListening && (
            <span className="flex items-center gap-1.5 text-[10px] text-[#FFF1B5]/70 font-mono ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFF1B5] animate-ping" />
              speak now
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {speechSupported && (
            <button
              onClick={() => setWakeMode((v) => !v)}
              title={wakeMode ? 'Disable "Hey EDITH"' : 'Enable "Hey EDITH" wake word'}
              className={`p-2 rounded-lg transition-all ${
                wakeMode
                  ? "text-[#C1DBE8] bg-[#C1DBE8]/10"
                  : "text-[#FFF1B5]/25 hover:text-[#FFF1B5]/50 hover:bg-[#FFF1B5]/5"
              }`}
            >
              <Radio size={14} />
            </button>
          )}
          <button
            onClick={() => { setVoiceEnabled((v) => !v); window.speechSynthesis?.cancel(); }}
            title={voiceEnabled ? "Mute responses" : "Enable voice responses"}
            className={`p-2 rounded-lg transition-all ${
              voiceEnabled
                ? "text-[#FFF1B5]/80 bg-[#FFF1B5]/8"
                : "text-[#FFF1B5]/25 hover:text-[#FFF1B5]/50 hover:bg-[#FFF1B5]/5"
            }`}
          >
            {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
          <button
            onClick={requestLocation}
            title={coords ? "Location active — click to refresh" : locationDenied ? "Location denied — click to retry" : "Enable location"}
            className={`p-2 rounded-lg transition-all ${
              coords
                ? "text-[#C1DBE8] bg-[#C1DBE8]/10"
                : "text-[#FFF1B5]/25 hover:text-[#FFF1B5]/50 hover:bg-[#FFF1B5]/5"
            }`}
          >
            {locationDenied ? <MapPinOff size={14} /> : <MapPin size={14} />}
          </button>
          <button
            onClick={clearChat}
            title="Clear conversation"
            className="p-2 rounded-lg text-[#FFF1B5]/20 hover:text-[#FFF1B5]/45 hover:bg-[#FFF1B5]/5 transition-all"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 scroll-smooth">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[78%] ${msg.role === "assistant" ? "space-y-2" : ""}`}>

              {/* Tool chips */}
              {msg.role === "assistant" && (msg.tools?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5 px-1">
                  {[...new Set(msg.tools)].map((tool) => (
                    <span
                      key={tool}
                      className="text-[10px] font-mono px-2.5 py-0.5 rounded-full"
                      style={{
                        background: "rgba(193,219,232,0.08)",
                        border: "1px solid rgba(193,219,232,0.18)",
                        color: "rgba(193,219,232,0.65)",
                      }}
                    >
                      {formatTool(tool)}
                    </span>
                  ))}
                </div>
              )}

              {/* Bubble */}
              <div
                className="px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
                style={
                  msg.role === "user"
                    ? {
                        background: "#43302E",
                        color: "#FFF1B5",
                        borderRadius: "18px 18px 4px 18px",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
                      }
                    : {
                        background: "rgba(255,241,181,0.04)",
                        border: "1px solid rgba(255,241,181,0.08)",
                        color: "rgba(255,241,181,0.88)",
                        borderRadius: "18px 18px 18px 4px",
                      }
                }
              >
                {msg.role === "assistant" ? cleanContent(msg.content) : msg.content}
                {msg.streaming && (
                  <span
                    className="inline-block w-[5px] h-[14px] ml-0.5 align-middle rounded-sm animate-pulse"
                    style={{ background: "rgba(255,241,181,0.4)" }}
                  />
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Active tool spinner */}
        {activeTools.length > 0 && (
          <div className="flex justify-start pl-1">
            <div
              className="flex items-center gap-2 text-[11px] font-mono px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(193,219,232,0.06)",
                border: "1px solid rgba(193,219,232,0.12)",
                color: "rgba(193,219,232,0.55)",
              }}
            >
              <Loader2 size={10} className="animate-spin" />
              {formatTool(activeTools[0])}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Suggestions ─────────────────────────────────────────────────── */}
      {messages.length === 1 && (
        <div className="px-5 pb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-xs rounded-full px-3.5 py-1.5 transition-all"
              style={{
                background: "rgba(255,241,181,0.05)",
                border: "1px solid rgba(255,241,181,0.12)",
                color: "rgba(255,241,181,0.45)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,241,181,0.09)";
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,241,181,0.7)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,241,181,0.22)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,241,181,0.05)";
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,241,181,0.45)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,241,181,0.12)";
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Input area ──────────────────────────────────────────────────── */}
      <div className="px-5 pb-5">
        <div
          className="flex items-end gap-2 px-4 py-3 rounded-2xl transition-all"
          style={
            isListening
              ? {
                  background: "rgba(67,48,46,0.4)",
                  border: "1px solid rgba(193,219,232,0.35)",
                  boxShadow: "0 0 0 3px rgba(193,219,232,0.06)",
                }
              : {
                  background: "rgba(255,241,181,0.04)",
                  border: "1px solid rgba(255,241,181,0.1)",
                  boxShadow: "0 2px 20px rgba(0,0,0,0.3)",
                }
          }
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={isListening ? "Listening…" : "Ask EDITH anything…"}
            rows={1}
            disabled={isListening}
            className="flex-1 bg-transparent text-sm resize-none outline-none leading-relaxed max-h-32 disabled:opacity-50"
            style={{ color: "rgba(255,241,181,0.85)", caretColor: "#FFF1B5" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
          />

          {speechSupported && (
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={loading}
              title={isListening ? "Stop" : "Speak"}
              className="shrink-0 p-1.5 rounded-lg transition-all disabled:opacity-30"
              style={{
                color: isListening ? "rgba(193,219,232,0.8)" : "rgba(255,241,181,0.3)",
              }}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}

          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading || isListening}
            className="shrink-0 p-1.5 rounded-lg transition-all disabled:opacity-20"
            style={{ color: "rgba(255,241,181,0.75)" }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>

        <p
          className="text-center text-[10px] mt-2 font-mono"
          style={{ color: "rgba(255,241,181,0.12)" }}
        >
          Enter to send · Shift+Enter for new line ·{" "}
          {wakeMode ? '"Hey EDITH" to activate' : "mic for voice"}
        </p>
      </div>
    </div>
  );
}

function formatTool(tool: string): string {
  return tool.replace(/_/g, " ");
}

function cleanContent(text: string): string {
  return text
    .replace(/\{[\s\S]*?"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:[\s\S]*?\}\s*\}/g, "")
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{1F300}-\u{1F9FF}]/gu, "")
    .trim();
}
