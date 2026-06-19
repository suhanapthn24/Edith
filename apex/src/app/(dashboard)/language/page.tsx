"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Languages, Plus, Flame, Star, Brain, BookOpen, ChevronRight, X } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type CEFR = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

interface Language {
  id: string;
  name: string;
  code: string;
  flag: string;
  cefr: CEFR;
  dailyGoalMins: number;
  streakDays: number;
  totalVocab: number;
  dueToday: number;
  mastered: number;
}

// ── Seed data ─────────────────────────────────────────────────────────────────

const SEED_LANGUAGES: Language[] = [
  {
    id: "fr", name: "French", code: "fr", flag: "🇫🇷",
    cefr: "B1", dailyGoalMins: 15, streakDays: 7,
    totalVocab: 312, dueToday: 24, mastered: 187,
  },
  {
    id: "ar", name: "Arabic", code: "ar", flag: "🇸🇦",
    cefr: "A1", dailyGoalMins: 10, streakDays: 2,
    totalVocab: 48, dueToday: 12, mastered: 8,
  },
];

const CEFR_OPTIONS: CEFR[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

const cefrColor: Record<CEFR, string> = {
  A1: "#933B5B", A2: "#933B5B",
  B1: "#AABAAE", B2: "#AABAAE",
  C1: "#E3D6BF", C2: "#E3D6BF",
};

// Common languages for quick-pick
const QUICK_LANGS = [
  { name: "French",     code: "fr", flag: "🇫🇷" },
  { name: "Spanish",    code: "es", flag: "🇪🇸" },
  { name: "German",     code: "de", flag: "🇩🇪" },
  { name: "Japanese",   code: "ja", flag: "🇯🇵" },
  { name: "Mandarin",   code: "zh", flag: "🇨🇳" },
  { name: "Arabic",     code: "ar", flag: "🇸🇦" },
  { name: "Portuguese", code: "pt", flag: "🇧🇷" },
  { name: "Italian",    code: "it", flag: "🇮🇹" },
  { name: "Korean",     code: "ko", flag: "🇰🇷" },
  { name: "Russian",    code: "ru", flag: "🇷🇺" },
  { name: "Hindi",      code: "hi", flag: "🇮🇳" },
  { name: "Dutch",      code: "nl", flag: "🇳🇱" },
];

// ── Add Language Modal ────────────────────────────────────────────────────────

function AddLanguageModal({ onAdd, onClose }: {
  onAdd: (lang: Language) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"pick" | "custom" | "details">("pick");
  const [selected, setSelected] = useState<{ name: string; code: string; flag: string } | null>(null);
  const [customName, setCustomName] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [customFlag, setCustomFlag] = useState("🌐");
  const [cefr, setCefr] = useState<CEFR>("A1");
  const [goal, setGoal] = useState(15);

  const confirm = () => {
    const base = step === "details" && selected
      ? selected
      : { name: customName.trim(), code: customCode.trim().toLowerCase(), flag: customFlag };

    if (!base.name || !base.code) return;

    onAdd({
      id: base.code + "_" + Date.now(),
      name: base.name,
      code: base.code,
      flag: base.flag,
      cefr,
      dailyGoalMins: goal,
      streakDays: 0,
      totalVocab: 0,
      dueToday: 0,
      mastered: 0,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#150D11]/80 backdrop-blur-sm">
      <div
        className="w-full max-w-md mx-4 rounded-2xl p-6 relative"
        style={{ background: "rgba(21,13,17,0.97)", border: "1px solid rgba(170,186,174,0.2)" }}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-[#E3D6BF]/40 hover:text-[#E3D6BF]">
          <X size={18} />
        </button>

        <h2 className="text-2xl text-[#E3D6BF] mb-5" style={{ fontFamily: "var(--font-cormorant)" }}>
          Add a language
        </h2>

        {/* Step 1: pick or custom */}
        {step === "pick" && (
          <>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {QUICK_LANGS.map(l => (
                <button
                  key={l.code}
                  onClick={() => { setSelected(l); setStep("details"); }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-[#E3D6BF] hover:bg-[#AABAAE]/10 transition-colors"
                  style={{ background: "rgba(30,17,24,0.4)", border: "1px solid rgba(170,186,174,0.1)" }}
                >
                  <span className="text-lg">{l.flag}</span>
                  <span className="text-xs">{l.name}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep("custom")}
              className="w-full py-2.5 rounded-xl text-sm text-[#AABAAE] hover:text-[#E3D6BF] transition-colors"
              style={{ border: "1px solid rgba(170,186,174,0.15)" }}
            >
              + Enter custom language
            </button>
          </>
        )}

        {/* Step 2a: custom input */}
        {step === "custom" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#AABAAE] mb-1 block">Language name</label>
              <input
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder="e.g. Swahili"
                className="w-full rounded-lg px-3 py-2 text-sm text-[#E3D6BF] placeholder:text-[#E3D6BF]/20 outline-none"
                style={{ background: "rgba(30,17,24,0.5)", border: "1px solid rgba(170,186,174,0.15)" }}
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-[#AABAAE] mb-1 block">Language code</label>
                <input
                  value={customCode}
                  onChange={e => setCustomCode(e.target.value)}
                  placeholder="e.g. sw"
                  maxLength={5}
                  className="w-full rounded-lg px-3 py-2 text-sm text-[#E3D6BF] placeholder:text-[#E3D6BF]/20 outline-none"
                  style={{ background: "rgba(30,17,24,0.5)", border: "1px solid rgba(170,186,174,0.15)" }}
                />
              </div>
              <div className="w-24">
                <label className="text-xs text-[#AABAAE] mb-1 block">Flag emoji</label>
                <input
                  value={customFlag}
                  onChange={e => setCustomFlag(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-lg text-center outline-none"
                  style={{ background: "rgba(30,17,24,0.5)", border: "1px solid rgba(170,186,174,0.15)" }}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setStep("pick")}
                className="flex-1 py-2.5 rounded-lg text-sm text-[#E3D6BF]/50 hover:text-[#E3D6BF] transition-colors"
                style={{ border: "1px solid rgba(170,186,174,0.1)" }}
              >
                Back
              </button>
              <button
                onClick={() => { setSelected({ name: customName, code: customCode, flag: customFlag }); setStep("details"); }}
                disabled={!customName.trim() || !customCode.trim()}
                className="flex-1 py-2.5 rounded-lg text-sm text-[#E3D6BF] font-medium transition-all disabled:opacity-30"
                style={{ background: "rgba(170,186,174,0.15)", border: "1px solid rgba(170,186,174,0.25)" }}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2b: details (cefr + goal) */}
        {step === "details" && selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl mb-2"
              style={{ background: "rgba(30,17,24,0.4)", border: "1px solid rgba(170,186,174,0.1)" }}>
              <span className="text-3xl">{selected.flag}</span>
              <div>
                <p className="text-[#E3D6BF] font-medium">{selected.name}</p>
                <p className="text-xs text-[#AABAAE]/60">{selected.code}</p>
              </div>
            </div>

            <div>
              <label className="text-xs text-[#AABAAE] mb-2 block">Starting CEFR level</label>
              <div className="flex gap-2">
                {CEFR_OPTIONS.map(c => (
                  <button
                    key={c}
                    onClick={() => setCefr(c)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: cefr === c ? `${cefrColor[c]}25` : "rgba(30,17,24,0.4)",
                      border: `1px solid ${cefr === c ? cefrColor[c] + "60" : "rgba(170,186,174,0.1)"}`,
                      color: cefr === c ? cefrColor[c] : "#E3D6BF",
                      opacity: cefr === c ? 1 : 0.5,
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-[#AABAAE] mb-2 block">Daily goal: <span className="text-[#E3D6BF]">{goal} min</span></label>
              <input
                type="range" min={5} max={60} step={5}
                value={goal}
                onChange={e => setGoal(Number(e.target.value))}
                className="w-full accent-[#AABAAE]"
              />
              <div className="flex justify-between text-[10px] text-[#E3D6BF]/25 mt-1">
                <span>5 min</span><span>60 min</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep(customName ? "custom" : "pick")}
                className="flex-1 py-2.5 rounded-lg text-sm text-[#E3D6BF]/50 hover:text-[#E3D6BF] transition-colors"
                style={{ border: "1px solid rgba(170,186,174,0.1)" }}
              >
                Back
              </button>
              <button
                onClick={confirm}
                className="flex-1 py-2.5 rounded-lg text-sm text-[#E3D6BF] font-medium transition-all hover:brightness-110"
                style={{ background: "rgba(147,59,91,0.3)", border: "1px solid rgba(147,59,91,0.4)" }}
              >
                Start learning {selected.name}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Language Card ─────────────────────────────────────────────────────────────

function LanguageCard({ lang, onClick }: { lang: Language; onClick: () => void }) {
  const pct = lang.totalVocab > 0 ? Math.round((lang.mastered / lang.totalVocab) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-5 transition-all hover:scale-[1.01] hover:brightness-110 group"
      style={{ background: "rgba(21,13,17,0.55)", border: "1px solid rgba(170,186,174,0.14)" }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{lang.flag}</span>
          <div>
            <h2 className="text-xl text-[#E3D6BF]" style={{ fontFamily: "var(--font-cormorant)" }}>{lang.name}</h2>
            <span
              className="text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: `${cefrColor[lang.cefr]}18`, color: cefrColor[lang.cefr] }}
            >
              {lang.cefr}
            </span>
          </div>
        </div>
        <ChevronRight size={16} className="text-[#E3D6BF]/20 group-hover:text-[#AABAAE] transition-colors mt-1" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { icon: BookOpen, label: "words", value: lang.totalVocab },
          { icon: Brain,    label: "due",   value: lang.dueToday, highlight: lang.dueToday > 0 },
          { icon: Flame,    label: "streak", value: `${lang.streakDays}d` },
        ].map(({ icon: Icon, label, value, highlight }) => (
          <div key={label} className="text-center">
            <Icon size={13} className={highlight ? "text-[#933B5B] mx-auto mb-1" : "text-[#AABAAE]/40 mx-auto mb-1"} />
            <p className={`text-lg font-light ${highlight ? "text-[#933B5B]" : "text-[#E3D6BF]"}`}
               style={{ fontFamily: "var(--font-cormorant)" }}>
              {value}
            </p>
            <p className="text-[10px] text-[#E3D6BF]/30">{label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-[10px] text-[#E3D6BF]/30 mb-1.5">
          <span>{lang.mastered} mastered</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg, #AABAAE, #933B5B)" }}
          />
        </div>
      </div>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LanguageIndexPage() {
  const router = useRouter();
  const [languages, setLanguages] = useState<Language[]>(SEED_LANGUAGES);
  const [showAdd, setShowAdd] = useState(false);

  const totalDue = languages.reduce((s, l) => s + l.dueToday, 0);

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Languages size={20} className="text-[#AABAAE]" />
            <h1 className="text-4xl font-light text-[#E3D6BF]" style={{ fontFamily: "var(--font-cormorant)" }}>
              Language Hub
            </h1>
          </div>
          <p className="text-sm text-[#E3D6BF]/40" style={{ fontFamily: "var(--font-dm-sans)" }}>
            {languages.length} language{languages.length !== 1 ? "s" : ""} · {totalDue} cards due today
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-[#E3D6BF] transition-all hover:brightness-110"
          style={{ background: "rgba(147,59,91,0.25)", border: "1px solid rgba(147,59,91,0.35)" }}
        >
          <Plus size={14} />
          Add language
        </button>
      </div>

      {/* Language cards */}
      {languages.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {languages.map(lang => (
            <LanguageCard
              key={lang.id}
              lang={lang}
              onClick={() => router.push(`/language/${lang.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <div className="p-5 rounded-2xl bg-[#AABAAE]/8">
            <Languages size={32} className="text-[#AABAAE]/50" />
          </div>
          <div className="text-center">
            <p className="text-[#E3D6BF]/60 text-lg mb-1" style={{ fontFamily: "var(--font-cormorant)" }}>
              No languages yet
            </p>
            <p className="text-sm text-[#E3D6BF]/30">Add your first language to start learning</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm text-[#E3D6BF] transition-all hover:brightness-110"
            style={{ background: "rgba(147,59,91,0.25)", border: "1px solid rgba(147,59,91,0.35)" }}
          >
            <Plus size={14} /> Add your first language
          </button>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <AddLanguageModal
          onAdd={lang => setLanguages(prev => [...prev, lang])}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
