"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, BookOpen, Brain, Flame, Star, Plus, Search,
  RotateCcw, X, ChevronDown, ChevronUp, Mic, Sparkles,
  Clock, TrendingUp, Target, Calendar, Map, CheckCircle2,
  ChevronRight, AlertCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type CEFR = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
type VocabStatus = "new" | "learning" | "mastered";
type Tab = "overview" | "vocab" | "review" | "roadmap" | "sessions";

interface VocabCard {
  id: number;
  word: string;
  translation: string;
  pronunciation?: string;
  example?: string;
  exampleTranslation?: string;
  gender?: string;
  tags: string[];
  repetitions: number;
  nextReview: string;
  easeFactor: number;
  aiGenerated?: boolean;
}

interface Session {
  id: number;
  date: string;
  type: string;
  durationMins: number;
  cardsReviewed: number;
  cardsCorrect: number;
}

interface RoadmapPhase {
  level: string;
  title: string;
  durationWeeks: number;
  vocabTarget?: number;
  topics: string[];
  weeklyGoals: string[];
  resources: string[];
  milestone: string;
}

interface Roadmap {
  phases: RoadmapPhase[];
  totalWeeks: number;
  totalVocabGoal: number;
  tips: string[];
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_DATA: Record<string, {
  name: string; flag: string; cefr: CEFR; dailyGoalMins: number;
  streakDays: number; mastered: number; totalVocab: number;
  vocab: VocabCard[]; sessions: Session[];
}> = {
  fr: {
    name: "French", flag: "🇫🇷", cefr: "B1", dailyGoalMins: 15,
    streakDays: 7, mastered: 187, totalVocab: 312,
    vocab: [
      { id: 1, word: "se souvenir", translation: "to remember", pronunciation: "/sə su.vniʁ/", example: "Je me souviens de toi.", exampleTranslation: "I remember you.", tags: ["verb", "reflexive", "B1"], repetitions: 3, nextReview: "2026-06-19", easeFactor: 2.5, aiGenerated: true },
      { id: 2, word: "quotidien", translation: "daily / everyday", pronunciation: "/kɔ.ti.djɛ̃/", example: "C'est mon quotidien.", exampleTranslation: "This is my daily life.", gender: "m", tags: ["adj", "B1"], repetitions: 0, nextReview: "2026-06-19", easeFactor: 2.5 },
      { id: 3, word: "pourtant", translation: "yet / however", pronunciation: "/puʁ.tɑ̃/", example: "Pourtant, il est venu.", exampleTranslation: "Yet, he came.", tags: ["adverb", "B1"], repetitions: 7, nextReview: "2026-06-25", easeFactor: 2.8, aiGenerated: true },
      { id: 4, word: "s'épanouir", translation: "to flourish", pronunciation: "/s‿e.pa.nwiʁ/", example: "Elle s'épanouit dans ce travail.", exampleTranslation: "She flourishes in this work.", tags: ["verb", "B2"], repetitions: 1, nextReview: "2026-06-19", easeFactor: 2.5 },
      { id: 5, word: "la méfiance", translation: "distrust", pronunciation: "/me.fjɑ̃s/", gender: "f", tags: ["noun", "B2"], repetitions: 2, nextReview: "2026-06-20", easeFactor: 2.3 },
      { id: 6, word: "désormais", translation: "henceforth / from now on", pronunciation: "/de.zɔʁ.mɛ/", example: "Désormais, sois prudent.", exampleTranslation: "From now on, be careful.", tags: ["adverb", "B2"], repetitions: 5, nextReview: "2026-06-22", easeFactor: 2.6, aiGenerated: true },
    ],
    sessions: [
      { id: 1, date: "2026-06-18", type: "Vocab review", durationMins: 12, cardsReviewed: 20, cardsCorrect: 17 },
      { id: 2, date: "2026-06-17", type: "Vocab review", durationMins: 8,  cardsReviewed: 15, cardsCorrect: 11 },
      { id: 3, date: "2026-06-16", type: "Listening",    durationMins: 20, cardsReviewed: 0,  cardsCorrect: 0  },
    ],
  },
  ar: {
    name: "Arabic", flag: "🇸🇦", cefr: "A1", dailyGoalMins: 10,
    streakDays: 2, mastered: 8, totalVocab: 48,
    vocab: [
      { id: 101, word: "مرحبا", translation: "Hello", pronunciation: "marḥaban", example: "مرحبا، كيف حالك؟", exampleTranslation: "Hello, how are you?", tags: ["greeting", "A1"], repetitions: 4, nextReview: "2026-06-19", easeFactor: 2.6 },
      { id: 102, word: "شكرا", translation: "Thank you", pronunciation: "shukran", tags: ["phrase", "A1"], repetitions: 6, nextReview: "2026-06-21", easeFactor: 2.9 },
      { id: 103, word: "كتاب", translation: "Book", pronunciation: "kitāb", gender: "m", tags: ["noun", "A1"], repetitions: 2, nextReview: "2026-06-19", easeFactor: 2.4 },
    ],
    sessions: [
      { id: 1, date: "2026-06-18", type: "Vocab review", durationMins: 7, cardsReviewed: 10, cardsCorrect: 8 },
    ],
  },
};

const cefrColor: Record<CEFR, string> = {
  A1: "#933B5B", A2: "#933B5B",
  B1: "#AABAAE", B2: "#AABAAE",
  C1: "#E3D6BF", C2: "#E3D6BF",
};

const CEFR_ORDER: CEFR[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

function getStatus(reps: number): VocabStatus {
  if (reps === 0) return "new";
  if (reps < 5) return "learning";
  return "mastered";
}

// ── AI Generate Modal ─────────────────────────────────────────────────────────

function AIGenerateModal({ langName, cefr, onGenerated, onClose }: {
  langName: string;
  cefr: string;
  onGenerated: (cards: VocabCard[]) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [generated, setGenerated] = useState<VocabCard[]>([]);

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/ai/vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: langName, cefr, prompt, count }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGenerated(data);
      setDone(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  const addToVocab = () => {
    onGenerated(generated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#150D11]/80 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-2xl p-6 relative max-h-[90vh] overflow-y-auto"
        style={{ background: "rgba(21,13,17,0.97)", border: "1px solid rgba(170,186,174,0.2)" }}>
        <button onClick={onClose} className="absolute top-4 right-4 text-[#E3D6BF]/40 hover:text-[#E3D6BF]">
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-[#933B5B]" />
          <h2 className="text-xl text-[#E3D6BF]" style={{ fontFamily: "var(--font-cormorant)" }}>
            AI Vocabulary Generator
          </h2>
        </div>

        {!done ? (
          <>
            <p className="text-xs text-[#AABAAE]/70 mb-4">
              Describe what you want to learn. AI will generate real, accurate {langName} flashcards.
            </p>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={`e.g. "${cefr} ${langName} verbs about daily routines" or "food and restaurant vocabulary"`}
              rows={3}
              className="w-full rounded-xl px-4 py-3 text-sm text-[#E3D6BF] placeholder:text-[#E3D6BF]/20 outline-none resize-none mb-3"
              style={{ background: "rgba(30,17,24,0.5)", border: "1px solid rgba(170,186,174,0.15)" }}
            />
            <div className="flex items-center gap-4 mb-4">
              <label className="text-xs text-[#AABAAE]">Cards to generate:</label>
              {[5, 10, 15, 20].map(n => (
                <button key={n} onClick={() => setCount(n)}
                  className="px-3 py-1 rounded-lg text-xs transition-all"
                  style={{
                    background: count === n ? "rgba(147,59,91,0.3)" : "rgba(30,17,24,0.4)",
                    border: `1px solid ${count === n ? "rgba(147,59,91,0.5)" : "rgba(170,186,174,0.1)"}`,
                    color: count === n ? "#E3D6BF" : "#AABAAE",
                  }}>
                  {n}
                </button>
              ))}
            </div>
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 mb-3 p-3 rounded-lg bg-red-900/20">
                <AlertCircle size={12} /> {error}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-lg text-sm text-[#E3D6BF]/50 hover:text-[#E3D6BF]"
                style={{ border: "1px solid rgba(170,186,174,0.1)" }}>
                Cancel
              </button>
              <button onClick={generate} disabled={!prompt.trim() || generating}
                className="flex-1 py-2.5 rounded-lg text-sm text-[#E3D6BF] font-medium transition-all hover:brightness-110 disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: "rgba(147,59,91,0.3)", border: "1px solid rgba(147,59,91,0.4)" }}>
                {generating
                  ? <><span className="animate-spin w-3 h-3 border border-[#E3D6BF]/40 border-t-[#E3D6BF] rounded-full inline-block" /> Generating…</>
                  : <><Sparkles size={13} /> Generate {count} cards</>}
              </button>
            </div>
          </>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={16} className="text-[#AABAAE]" />
              <p className="text-sm text-[#E3D6BF]">{generated.length} cards generated for {langName}</p>
            </div>
            <div className="space-y-2 mb-5 max-h-60 overflow-y-auto pr-1">
              {generated.map(card => (
                <div key={card.id} className="rounded-xl px-4 py-2.5"
                  style={{ background: "rgba(30,17,24,0.4)", border: "1px solid rgba(170,186,174,0.1)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-sm text-[#E3D6BF]">{card.word}</span>
                      {card.gender && <span className="ml-1.5 text-xs text-[#933B5B]">{card.gender}</span>}
                      <span className="text-xs text-[#E3D6BF]/40 ml-2">→ {card.translation}</span>
                    </div>
                  </div>
                  {card.pronunciation && <p className="text-xs text-[#AABAAE]/50 mt-0.5">{card.pronunciation}</p>}
                  {card.example && <p className="text-xs text-[#E3D6BF]/35 italic mt-0.5">{card.example}</p>}
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDone(false)}
                className="flex-1 py-2.5 rounded-lg text-sm text-[#E3D6BF]/50 hover:text-[#E3D6BF]"
                style={{ border: "1px solid rgba(170,186,174,0.1)" }}>
                Try again
              </button>
              <button onClick={addToVocab}
                className="flex-1 py-2.5 rounded-lg text-sm text-[#E3D6BF] font-medium hover:brightness-110"
                style={{ background: "rgba(147,59,91,0.3)", border: "1px solid rgba(147,59,91,0.4)" }}>
                Add to vocabulary
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add Vocab Modal ────────────────────────────────────────────────────────────

function AddVocabModal({ langName, onAdd, onClose }: {
  langName: string;
  onAdd: (card: VocabCard) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ word: "", translation: "", pronunciation: "", example: "", gender: "", tags: "" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.word.trim() || !form.translation.trim()) return;
    const now = new Date().toISOString().split("T")[0];
    onAdd({
      id: Date.now(),
      word: form.word.trim(),
      translation: form.translation.trim(),
      pronunciation: form.pronunciation.trim() || undefined,
      example: form.example.trim() || undefined,
      gender: form.gender.trim() || undefined,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      repetitions: 0,
      nextReview: now,
      easeFactor: 2.5,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#150D11]/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-2xl p-6 relative"
        style={{ background: "rgba(21,13,17,0.97)", border: "1px solid rgba(170,186,174,0.2)" }}>
        <button onClick={onClose} className="absolute top-4 right-4 text-[#E3D6BF]/40 hover:text-[#E3D6BF]">
          <X size={18} />
        </button>
        <h2 className="text-xl text-[#E3D6BF] mb-5" style={{ fontFamily: "var(--font-cormorant)" }}>
          Add to {langName}
        </h2>
        <div className="space-y-3">
          {[
            { key: "word",          label: "Word / Phrase *", placeholder: "target language word" },
            { key: "translation",   label: "Translation *",   placeholder: "English meaning" },
            { key: "pronunciation", label: "Pronunciation",   placeholder: "IPA or phonetic (optional)" },
            { key: "example",      label: "Example sentence", placeholder: "in the target language (optional)" },
            { key: "gender",       label: "Gender",           placeholder: "m / f / n (optional)" },
            { key: "tags",         label: "Tags",             placeholder: "verb, B1, food (comma-separated)" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs text-[#AABAAE] mb-1 block">{f.label}</label>
              <input
                value={form[f.key as keyof typeof form]}
                onChange={e => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full rounded-lg px-3 py-2 text-sm text-[#E3D6BF] placeholder:text-[#E3D6BF]/20 outline-none"
                style={{ background: "rgba(30,17,24,0.5)", border: "1px solid rgba(170,186,174,0.15)" }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm text-[#E3D6BF]/50"
            style={{ border: "1px solid rgba(170,186,174,0.1)" }}>
            Cancel
          </button>
          <button onClick={submit} disabled={!form.word.trim() || !form.translation.trim()}
            className="flex-1 py-2.5 rounded-lg text-sm text-[#E3D6BF] font-medium hover:brightness-110 disabled:opacity-40"
            style={{ background: "rgba(147,59,91,0.3)", border: "1px solid rgba(147,59,91,0.4)" }}>
            Add card
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Review Modal ───────────────────────────────────────────────────────────────

function ReviewModal({ cards, onClose }: { cards: VocabCard[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [grades, setGrades] = useState<number[]>([]);

  const finished = grades.length >= cards.length;
  const current = cards[idx];

  const grade = (g: number) => {
    setGrades(prev => [...prev, g]);
    setFlipped(false);
    if (idx + 1 < cards.length) setIdx(i => i + 1);
  };

  const accuracy = grades.length > 0
    ? Math.round((grades.filter(g => g >= 3).length / grades.length) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#150D11]/80 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-2xl p-8 relative"
        style={{ background: "rgba(21,13,17,0.97)", border: "1px solid rgba(170,186,174,0.2)" }}>
        <button onClick={onClose} className="absolute top-4 right-4 text-[#E3D6BF]/40 hover:text-[#E3D6BF]">
          <X size={18} />
        </button>

        {finished ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">{accuracy >= 80 ? "🎉" : accuracy >= 60 ? "👍" : "💪"}</div>
            <p className="text-2xl text-[#E3D6BF] mb-1" style={{ fontFamily: "var(--font-cormorant)" }}>Session complete</p>
            <p className="text-sm text-[#AABAAE] mb-6">
              {grades.filter(g => g >= 3).length}/{cards.length} correct · {accuracy}% accuracy
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: "Again", count: grades.filter(g => g === 1).length, color: "#933B5B" },
                { label: "Good+", count: grades.filter(g => g >= 4).length, color: "#AABAAE" },
              ].map(({ label, count, color }) => (
                <div key={label} className="rounded-xl py-3 text-center"
                  style={{ background: `${color}12`, border: `1px solid ${color}30` }}>
                  <p className="text-2xl font-light" style={{ fontFamily: "var(--font-cormorant)", color }}>{count}</p>
                  <p className="text-xs" style={{ color }}>{label}</p>
                </div>
              ))}
            </div>
            <button onClick={onClose}
              className="px-8 py-2.5 rounded-xl text-sm text-[#E3D6BF] font-medium hover:brightness-110"
              style={{ background: "rgba(147,59,91,0.3)", border: "1px solid rgba(147,59,91,0.4)" }}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-between text-xs text-[#AABAAE]/50 mb-4">
              <span>{idx + 1} / {cards.length}</span>
              <span>{grades.filter(g => g >= 3).length} correct</span>
            </div>
            <div className="h-0.5 bg-[#AABAAE]/10 rounded mb-6">
              <div className="h-full bg-[#AABAAE] rounded transition-all duration-300"
                style={{ width: `${(idx / cards.length) * 100}%` }} />
            </div>

            <div
              className="rounded-2xl p-8 text-center cursor-pointer min-h-[200px] flex flex-col items-center justify-center gap-2 transition-all"
              style={{ background: "rgba(30,17,24,0.4)", border: "1px solid rgba(170,186,174,0.1)" }}
              onClick={() => setFlipped(true)}
            >
              {current.gender && <span className="text-xs text-[#933B5B] uppercase tracking-widest">{current.gender}</span>}
              <p className="text-4xl text-[#E3D6BF]" style={{ fontFamily: "var(--font-cormorant)" }}>{current.word}</p>
              {current.pronunciation && <p className="text-sm text-[#AABAAE]/50">{current.pronunciation}</p>}
              {current.aiGenerated && (
                <span className="flex items-center gap-1 text-[10px] text-[#933B5B]/60 mt-1">
                  <Sparkles size={9} /> AI generated
                </span>
              )}
              {!flipped && <p className="text-xs text-[#E3D6BF]/20 mt-4">tap to reveal</p>}
              {flipped && (
                <div className="mt-4 pt-4 border-t border-[#AABAAE]/10 w-full">
                  <p className="text-xl text-[#E3D6BF] mb-1">{current.translation}</p>
                  {current.example && <p className="text-sm text-[#AABAAE]/60 italic mt-1">{current.example}</p>}
                  {current.exampleTranslation && <p className="text-xs text-[#AABAAE]/30 mt-0.5">{current.exampleTranslation}</p>}
                </div>
              )}
            </div>

            {flipped && (
              <div className="flex gap-2 mt-5">
                {[
                  { label: "Again", g: 1, color: "#933B5B" },
                  { label: "Hard",  g: 3, color: "#AABAAE" },
                  { label: "Good",  g: 4, color: "#E3D6BF" },
                  { label: "Easy",  g: 5, color: "#AABAAE" },
                ].map(({ label, g, color }) => (
                  <button key={label} onClick={() => grade(g)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.02]"
                    style={{ background: `${color}15`, border: `1px solid ${color}35`, color }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: typeof MOCK_DATA[string] }) {
  const today = new Date().toISOString().split("T")[0];
  const due = data.vocab.filter(v => v.nextReview <= today).length;
  const weekMins = data.sessions.reduce((s, sess) => s + sess.durationMins, 0);
  const avgAccuracy = data.sessions.length > 0
    ? Math.round(data.sessions.reduce((s, sess) =>
        s + (sess.cardsReviewed > 0 ? sess.cardsCorrect / sess.cardsReviewed : 0), 0
      ) / data.sessions.length * 100)
    : 0;
  const pctMastered = data.totalVocab > 0 ? Math.round((data.mastered / data.totalVocab) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Brain,      label: "Due today", value: due,               sub: "cards",     highlight: due > 0, color: "#933B5B" },
          { icon: Star,       label: "Mastered",  value: data.mastered,     sub: `of ${data.totalVocab}` },
          { icon: Clock,      label: "This week", value: `${weekMins}m`,   sub: "studied" },
          { icon: TrendingUp, label: "Accuracy",  value: `${avgAccuracy}%`, sub: "avg recall" },
        ].map(({ icon: Icon, label, value, sub, highlight, color }) => (
          <div key={label} className="rounded-2xl p-4"
            style={{ background: "rgba(21,13,17,0.5)", border: "1px solid rgba(170,186,174,0.12)" }}>
            <Icon size={14} className="mb-2" style={{ color: highlight ? color : "#AABAAE" }} />
            <p className="text-2xl font-light text-[#E3D6BF]"
              style={{ fontFamily: "var(--font-cormorant)", color: highlight ? color : undefined }}>
              {value}
            </p>
            <p className="text-xs text-[#E3D6BF]/40 mt-0.5">{label}</p>
            <p className="text-[10px] text-[#E3D6BF]/20">{sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl p-5"
        style={{ background: "rgba(21,13,17,0.5)", border: "1px solid rgba(170,186,174,0.12)" }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-[#E3D6BF]">Vocabulary mastery</p>
            <p className="text-xs text-[#AABAAE]/50">{data.cefr} level progress</p>
          </div>
          <span className="text-xs text-[#AABAAE]">{pctMastered}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/5">
          <div className="h-full rounded-full"
            style={{ width: `${pctMastered}%`, background: "linear-gradient(90deg, #AABAAE, #933B5B)" }} />
        </div>
      </div>

      <div className="rounded-2xl p-5 flex items-start gap-3"
        style={{ background: "rgba(21,13,17,0.5)", borderLeft: "3px solid #933B5B", border: "1px solid rgba(147,59,91,0.2)" }}>
        <Sparkles size={16} className="text-[#933B5B] mt-0.5 shrink-0" />
        <div>
          <p className="text-sm text-[#E3D6BF] mb-1">AI Learning Insight</p>
          <p className="text-xs text-[#E3D6BF]/50 leading-relaxed">
            You have {due} cards due today. Your average session accuracy is {avgAccuracy}% — aim for 80%+ to advance to the next CEFR level.
            Based on your pace, you are on track to master {data.cefr} in about {Math.max(1, Math.ceil((data.totalVocab - data.mastered) / 40))} weeks.
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs text-[#E3D6BF]/40 mb-3 uppercase tracking-widest">Recent sessions</p>
        <div className="space-y-2">
          {data.sessions.slice(0, 3).map(sess => (
            <div key={sess.id} className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: "rgba(21,13,17,0.4)", border: "1px solid rgba(170,186,174,0.08)" }}>
              <div className="flex items-center gap-3">
                <Calendar size={13} className="text-[#AABAAE]/40" />
                <div>
                  <p className="text-sm text-[#E3D6BF]">{sess.type}</p>
                  <p className="text-xs text-[#E3D6BF]/30">{sess.date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-[#E3D6BF]">{sess.durationMins}m</p>
                {sess.cardsReviewed > 0 && (
                  <p className="text-xs text-[#AABAAE]/50">{sess.cardsCorrect}/{sess.cardsReviewed} correct</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Vocab Tab ─────────────────────────────────────────────────────────────────

function VocabTab({ vocab, langName, cefr, onStartReview, onVocabAdd, onVocabGenerated }: {
  vocab: VocabCard[];
  langName: string;
  cefr: string;
  onStartReview: () => void;
  onVocabAdd: (card: VocabCard) => void;
  onVocabGenerated: (cards: VocabCard[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "due" | "new" | "mastered">("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showAI, setShowAI] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const filtered = useMemo(() => vocab.filter(v => {
    if (search && !v.word.toLowerCase().includes(search.toLowerCase()) &&
        !v.translation.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "due") return v.nextReview <= today;
    if (filter === "new") return v.repetitions === 0;
    if (filter === "mastered") return v.repetitions >= 5;
    return true;
  }), [vocab, search, filter, today]);

  const dueCount = vocab.filter(v => v.nextReview <= today).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: "rgba(21,13,17,0.5)", border: "1px solid rgba(170,186,174,0.12)" }}>
          <Search size={13} className="text-[#AABAAE]/50" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search words…"
            className="flex-1 text-sm text-[#E3D6BF] bg-transparent outline-none placeholder:text-[#E3D6BF]/20" />
        </div>
        <button onClick={() => setShowAI(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-[#933B5B] transition-all hover:brightness-110"
          style={{ background: "rgba(147,59,91,0.12)", border: "1px solid rgba(147,59,91,0.25)" }}>
          <Sparkles size={13} /> AI generate
        </button>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-[#E3D6BF] transition-all hover:brightness-110"
          style={{ background: "rgba(170,186,174,0.12)", border: "1px solid rgba(170,186,174,0.2)" }}>
          <Plus size={13} /> Add
        </button>
      </div>

      {dueCount > 0 && (
        <div className="rounded-xl p-4 flex items-center justify-between"
          style={{ background: "rgba(147,59,91,0.1)", border: "1px solid rgba(147,59,91,0.2)" }}>
          <div className="flex items-center gap-3">
            <RotateCcw size={14} className="text-[#933B5B]" />
            <p className="text-sm text-[#E3D6BF]">{dueCount} cards due for review</p>
          </div>
          <button onClick={onStartReview}
            className="px-4 py-1.5 rounded-lg text-sm text-[#E3D6BF] hover:brightness-110"
            style={{ background: "rgba(147,59,91,0.25)", border: "1px solid rgba(147,59,91,0.35)" }}>
            Review now
          </button>
        </div>
      )}

      <div className="flex gap-1">
        {(["all", "due", "new", "mastered"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-xs capitalize transition-colors"
            style={filter === f
              ? { background: "rgba(170,186,174,0.15)", color: "#E3D6BF" }
              : { color: "#AABAAE" }}>
            {f}
          </button>
        ))}
        <span className="ml-auto text-xs text-[#E3D6BF]/30 self-center">{filtered.length} words</span>
      </div>

      <div className="rounded-2xl overflow-hidden"
        style={{ background: "rgba(21,13,17,0.5)", border: "1px solid rgba(170,186,174,0.12)" }}>
        {filtered.map((card, i) => {
          const status = getStatus(card.repetitions);
          const isDue = card.nextReview <= today;
          const isExpanded = expanded === card.id;

          return (
            <div key={card.id}
              className={`border-b last:border-b-0 ${i % 2 === 0 ? "bg-transparent" : "bg-[#1E1118]/10"}`}
              style={{ borderColor: "rgba(170,186,174,0.06)" }}>
              <button
                className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-[#AABAAE]/5 transition-colors"
                onClick={() => setExpanded(isExpanded ? null : card.id)}
              >
                <div className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: isDue ? "#933B5B" : status === "mastered" ? "#AABAAE" : "#E3D6BF" }} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-[#E3D6BF]">{card.word}</span>
                  {card.gender && <span className="ml-2 text-xs text-[#933B5B]">{card.gender}</span>}
                  {card.aiGenerated && <Sparkles size={10} className="inline ml-1.5 text-[#933B5B]/40" />}
                </div>
                <span className="text-sm text-[#E3D6BF]/50 min-w-[120px] text-right truncate">{card.translation}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full ml-2"
                  style={{
                    background: isDue ? "rgba(147,59,91,0.15)" : "rgba(170,186,174,0.1)",
                    color: isDue ? "#933B5B" : "#AABAAE",
                  }}>
                  {isDue ? "due" : status}
                </span>
                {isExpanded ? <ChevronUp size={13} className="text-[#E3D6BF]/20" /> : <ChevronDown size={13} className="text-[#E3D6BF]/20" />}
              </button>

              {isExpanded && (
                <div className="px-5 pb-4 pt-1 space-y-1.5">
                  {card.pronunciation && <p className="text-sm text-[#AABAAE]/60 ml-6">{card.pronunciation}</p>}
                  {card.example && <p className="text-sm text-[#E3D6BF]/50 italic ml-6">&ldquo;{card.example}&rdquo;</p>}
                  {card.exampleTranslation && <p className="text-xs text-[#E3D6BF]/30 ml-6">{card.exampleTranslation}</p>}
                  <div className="ml-6 flex flex-wrap gap-1 mt-1">
                    {card.tags.map(t => (
                      <span key={t} className="px-2 py-0.5 rounded text-[10px]"
                        style={{ background: "rgba(170,186,174,0.1)", color: "#AABAAE" }}>{t}</span>
                    ))}
                  </div>
                  <div className="ml-6 flex gap-4 text-xs text-[#E3D6BF]/25 mt-0.5">
                    <span>Reps: {card.repetitions}</span>
                    <span>EF: {card.easeFactor.toFixed(1)}</span>
                    <span>Next: {card.nextReview}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-10 text-[#E3D6BF]/25 text-sm">
            {search ? "No words match your search." : "No words in this filter."}
          </div>
        )}
      </div>

      {showAdd && <AddVocabModal langName={langName} onAdd={onVocabAdd} onClose={() => setShowAdd(false)} />}
      {showAI && <AIGenerateModal langName={langName} cefr={cefr} onGenerated={onVocabGenerated} onClose={() => setShowAI(false)} />}
    </div>
  );
}

// ── Roadmap Tab ────────────────────────────────────────────────────────────────

const CEFR_LABELS: Record<string, string> = {
  A1: "Beginner", A2: "Elementary",
  B1: "Intermediate", B2: "Upper Intermediate",
  C1: "Advanced", C2: "Mastery",
};

function RoadmapTab({ langName, cefr }: { langName: string; cefr: CEFR }) {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: langName, cefr, targetCefr: "C2", dailyGoalMins: 15 }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRoadmap(data);
      if (data.phases?.length > 0) setExpanded(data.phases[0].level);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!roadmap && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-5">
        <div className="p-5 rounded-2xl" style={{ background: "rgba(170,186,174,0.08)", border: "1px solid rgba(170,186,174,0.12)" }}>
          <Map size={32} className="text-[#AABAAE]/60" />
        </div>
        <div className="text-center">
          <p className="text-xl text-[#E3D6BF] mb-1" style={{ fontFamily: "var(--font-cormorant)" }}>
            Your {langName} learning roadmap
          </p>
          <p className="text-sm text-[#E3D6BF]/40 max-w-xs">
            AI will generate a personalized curriculum from {cefr} to C2 with topics, goals, and milestones for each phase.
          </p>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-xs text-red-400 p-3 rounded-lg bg-red-900/20">
            <AlertCircle size={12} /> {error}
          </div>
        )}
        <button onClick={generate}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm text-[#E3D6BF] font-medium hover:brightness-110 transition-all"
          style={{ background: "rgba(147,59,91,0.3)", border: "1px solid rgba(147,59,91,0.4)" }}>
          <Sparkles size={14} /> Generate AI Roadmap
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <div className="w-6 h-6 border-2 border-[#AABAAE]/30 border-t-[#AABAAE] rounded-full animate-spin" />
        <p className="text-sm text-[#E3D6BF]/50">Generating your {langName} roadmap…</p>
      </div>
    );
  }

  const cefrIndex = CEFR_ORDER.indexOf(cefr);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Phases",        value: roadmap!.phases.length },
          { label: "Total weeks",   value: `~${roadmap!.totalWeeks}w` },
          { label: "Vocab goal",    value: `${(roadmap!.totalVocabGoal ?? 5000).toLocaleString()} words` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl p-3 text-center"
            style={{ background: "rgba(21,13,17,0.5)", border: "1px solid rgba(170,186,174,0.1)" }}>
            <p className="text-xl text-[#E3D6BF]" style={{ fontFamily: "var(--font-cormorant)" }}>{value}</p>
            <p className="text-xs text-[#E3D6BF]/35">{label}</p>
          </div>
        ))}
      </div>

      {/* Phase cards */}
      {roadmap!.phases.map((phase, i) => {
        const phaseIdx = CEFR_ORDER.indexOf(phase.level as CEFR);
        const isCurrent = phase.level === cefr;
        const isComplete = phaseIdx < cefrIndex;
        const isExpanded = expanded === phase.level;

        return (
          <div key={phase.level}
            className="rounded-2xl overflow-hidden transition-all"
            style={{
              background: "rgba(21,13,17,0.5)",
              border: `1px solid ${isCurrent ? "rgba(170,186,174,0.35)" : isComplete ? "rgba(147,59,91,0.2)" : "rgba(170,186,174,0.1)"}`,
              opacity: isComplete ? 0.7 : 1,
            }}>
            <button className="w-full flex items-center gap-4 px-5 py-4 text-left"
              onClick={() => setExpanded(isExpanded ? null : phase.level)}>
              {/* Level badge */}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold"
                style={{
                  background: isCurrent ? "rgba(170,186,174,0.2)" : isComplete ? "rgba(147,59,91,0.15)" : "rgba(30,17,24,0.5)",
                  color: isCurrent ? "#E3D6BF" : isComplete ? "#933B5B" : "#AABAAE",
                  border: isCurrent ? "1px solid rgba(170,186,174,0.3)" : "1px solid transparent",
                }}>
                {isComplete ? <CheckCircle2 size={16} /> : phase.level}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-[#E3D6BF]">{CEFR_LABELS[phase.level] ?? phase.title}</p>
                  {isCurrent && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(170,186,174,0.15)", color: "#AABAAE" }}>
                      current level
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#E3D6BF]/30 mt-0.5">
                  ~{phase.durationWeeks} weeks · {phase.vocabTarget?.toLocaleString() ?? "–"} words
                </p>
              </div>

              {/* Progress indicator */}
              <div className="flex items-center gap-2">
                {i < roadmap!.phases.length - 1 && (
                  <ChevronRight size={12} className="text-[#E3D6BF]/15" />
                )}
                {isExpanded ? <ChevronUp size={14} className="text-[#E3D6BF]/30" /> : <ChevronDown size={14} className="text-[#E3D6BF]/30" />}
              </div>
            </button>

            {isExpanded && (
              <div className="px-5 pb-5 pt-1 border-t border-[#AABAAE]/8 space-y-4">
                {/* Topics */}
                <div>
                  <p className="text-[10px] text-[#AABAAE] uppercase tracking-widest mb-2">Topics to cover</p>
                  <div className="flex flex-wrap gap-1.5">
                    {phase.topics.map(t => (
                      <span key={t} className="px-2.5 py-1 rounded-lg text-xs"
                        style={{ background: "rgba(30,17,24,0.6)", color: "#E3D6BF", border: "1px solid rgba(170,186,174,0.1)" }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Weekly goals */}
                <div>
                  <p className="text-[10px] text-[#AABAAE] uppercase tracking-widest mb-2">Weekly goals</p>
                  <ul className="space-y-1">
                    {phase.weeklyGoals.map(g => (
                      <li key={g} className="flex items-start gap-2 text-xs text-[#E3D6BF]/60">
                        <span className="text-[#AABAAE] mt-0.5">·</span> {g}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Resources */}
                <div>
                  <p className="text-[10px] text-[#AABAAE] uppercase tracking-widest mb-2">Resources</p>
                  <ul className="space-y-1">
                    {phase.resources.map(r => (
                      <li key={r} className="flex items-start gap-2 text-xs text-[#E3D6BF]/50">
                        <BookOpen size={10} className="text-[#933B5B] mt-0.5 shrink-0" /> {r}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Milestone */}
                <div className="rounded-xl p-3"
                  style={{ background: "rgba(147,59,91,0.08)", border: "1px solid rgba(147,59,91,0.15)" }}>
                  <p className="text-[10px] text-[#933B5B] uppercase tracking-widest mb-1">Level milestone</p>
                  <p className="text-xs text-[#E3D6BF]/70">{phase.milestone}</p>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Tips */}
      {roadmap!.tips && roadmap!.tips.length > 0 && (
        <div className="rounded-2xl p-5"
          style={{ background: "rgba(21,13,17,0.5)", border: "1px solid rgba(170,186,174,0.1)" }}>
          <p className="text-xs text-[#AABAAE] uppercase tracking-widest mb-3">Learning tips</p>
          <ul className="space-y-2">
            {roadmap!.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[#E3D6BF]/60">
                <Sparkles size={10} className="text-[#933B5B] mt-0.5 shrink-0" /> {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button onClick={generate}
        className="w-full py-2.5 rounded-xl text-xs text-[#E3D6BF]/40 hover:text-[#E3D6BF]/70 transition-colors flex items-center justify-center gap-2">
        <RotateCcw size={11} /> Regenerate roadmap
      </button>
    </div>
  );
}

// ── Sessions Tab ──────────────────────────────────────────────────────────────

function SessionsTab({ sessions }: { sessions: Session[] }) {
  const typeIcons: Record<string, React.ReactNode> = {
    "Vocab review": <RotateCcw size={13} />,
    "Listening":   <Mic size={13} />,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total sessions",  value: sessions.length },
          { label: "Total time",      value: `${sessions.reduce((s, x) => s + x.durationMins, 0)}m` },
          { label: "Cards reviewed",  value: sessions.reduce((s, x) => s + x.cardsReviewed, 0) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl p-4 text-center"
            style={{ background: "rgba(21,13,17,0.5)", border: "1px solid rgba(170,186,174,0.1)" }}>
            <p className="text-2xl text-[#E3D6BF] font-light" style={{ fontFamily: "var(--font-cormorant)" }}>{value}</p>
            <p className="text-xs text-[#E3D6BF]/35 mt-1">{label}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {sessions.map(sess => (
          <div key={sess.id} className="flex items-center gap-4 rounded-xl px-4 py-3"
            style={{ background: "rgba(21,13,17,0.4)", border: "1px solid rgba(170,186,174,0.08)" }}>
            <div className="text-[#AABAAE]/40">{typeIcons[sess.type] ?? <Target size={13} />}</div>
            <div className="flex-1">
              <p className="text-sm text-[#E3D6BF]">{sess.type}</p>
              <p className="text-xs text-[#E3D6BF]/30">{sess.date}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-[#E3D6BF]">{sess.durationMins}m</p>
              {sess.cardsReviewed > 0 && (
                <p className="text-xs text-[#AABAAE]/50">
                  {Math.round((sess.cardsCorrect / sess.cardsReviewed) * 100)}% correct
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LanguageDetailPage() {
  const params = useParams();
  const router = useRouter();
  const langId = params.lang as string;

  const baseData = MOCK_DATA[langId] ?? MOCK_DATA.fr;
  const [vocab, setVocab] = useState<VocabCard[]>(baseData.vocab);

  const [tab, setTab] = useState<Tab>("overview");
  const [showReview, setShowReview] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const dueCards = vocab.filter(v => v.nextReview <= today);

  const addVocab = (card: VocabCard) => setVocab(prev => [card, ...prev]);
  const addManyVocab = (cards: VocabCard[]) => setVocab(prev => [...cards, ...prev]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "overview",  label: "Overview",  icon: <TrendingUp size={14} /> },
    { key: "vocab",     label: "Vocabulary", icon: <BookOpen size={14} /> },
    { key: "review",    label: `Review (${dueCards.length})`, icon: <RotateCcw size={14} /> },
    { key: "roadmap",   label: "Roadmap",   icon: <Map size={14} /> },
    { key: "sessions",  label: "Sessions",  icon: <Calendar size={14} /> },
  ];

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push("/language")}
          className="p-2 rounded-xl text-[#E3D6BF]/40 hover:text-[#E3D6BF] hover:bg-[#AABAAE]/8 transition-all">
          <ArrowLeft size={16} />
        </button>
        <span className="text-3xl">{baseData.flag}</span>
        <div>
          <h1 className="text-3xl font-light text-[#E3D6BF]" style={{ fontFamily: "var(--font-cormorant)" }}>
            {baseData.name}
          </h1>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: `${cefrColor[baseData.cefr]}18`, color: cefrColor[baseData.cefr] }}>
              {baseData.cefr}
            </span>
            <span className="flex items-center gap-1 text-xs text-[#E3D6BF]/35">
              <Flame size={11} className="text-[#933B5B]" /> {baseData.streakDays} day streak
            </span>
            <span className="text-xs text-[#E3D6BF]/30">{vocab.length} words</span>
          </div>
        </div>

        {dueCards.length > 0 && tab !== "review" && (
          <button onClick={() => setShowReview(true)}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-[#E3D6BF] hover:brightness-110 transition-all"
            style={{ background: "rgba(147,59,91,0.25)", border: "1px solid rgba(147,59,91,0.35)" }}>
            <RotateCcw size={13} /> Review {dueCards.length}
          </button>
        )}
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto"
        style={{ background: "rgba(21,13,17,0.4)", border: "1px solid rgba(170,186,174,0.1)" }}>
        {tabs.map(t => (
          <button key={t.key}
            onClick={() => { setTab(t.key); if (t.key === "review") setShowReview(true); }}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-all whitespace-nowrap min-w-fit px-2"
            style={tab === t.key
              ? { background: "rgba(170,186,174,0.15)", color: "#E3D6BF" }
              : { color: "#AABAAE" }}>
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && <OverviewTab data={{ ...baseData, vocab }} />}
      {tab === "vocab" && (
        <VocabTab
          vocab={vocab}
          langName={baseData.name}
          cefr={baseData.cefr}
          onStartReview={() => setShowReview(true)}
          onVocabAdd={addVocab}
          onVocabGenerated={addManyVocab}
        />
      )}
      {tab === "roadmap" && <RoadmapTab langName={baseData.name} cefr={baseData.cefr} />}
      {tab === "sessions" && <SessionsTab sessions={baseData.sessions} />}

      {showReview && dueCards.length > 0 && (
        <ReviewModal cards={dueCards} onClose={() => setShowReview(false)} />
      )}
    </div>
  );
}
