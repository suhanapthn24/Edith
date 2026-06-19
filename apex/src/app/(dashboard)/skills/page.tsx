"use client";

import { useState, useMemo } from "react";
import {
  GraduationCap, Plus, X, ChevronDown, Check, Loader2,
  Sparkles, AlertCircle, BookOpen, Trophy, Clock, Target,
  ExternalLink, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type CertStatus = "planned" | "in_progress" | "completed";
type CertCategory = "cloud" | "data" | "programming" | "ai_ml" | "security" | "database";

interface Resource {
  name: string;
  type: "course" | "book" | "practice" | "docs";
  url?: string;
  completed: boolean;
}

interface Certification {
  id: number;
  name: string;
  provider: string;
  category: CertCategory;
  level: string;
  status: CertStatus;
  progress: number;
  examDate?: string;
  completedDate?: string;
  targetHours: number;
  studiedHours: number;
  score?: number;
  resources: Resource[];
  notes: string;
}

interface StudyPlanPhase {
  phaseNumber: number;
  title: string;
  weeks: string;
  hoursRequired: number;
  topics: string[];
  goals: string[];
  resources: string[];
  practiceTests: boolean;
  milestone: string;
}

interface StudyPlan {
  phases: StudyPlanPhase[];
  totalWeeks: number;
  totalHours: number;
  dailySchedule: string;
  examReadinessChecklist: string[];
  tips: string[];
}

// ── Mock data ────────────────────────────────────────────────────────────────

const INITIAL_CERTS: Certification[] = [
  {
    id: 1,
    name: "AWS Certified Solutions Architect – Associate",
    provider: "Amazon Web Services",
    category: "cloud",
    level: "Associate",
    status: "in_progress",
    progress: 42,
    targetHours: 80,
    studiedHours: 34,
    examDate: "2026-08-15",
    resources: [
      { name: "Stephane Maarek — SAA-C03 Course", type: "course", url: "https://udemy.com", completed: true },
      { name: "AWS Official Practice Exam", type: "practice", completed: false },
      { name: "Tutorials Dojo Practice Tests", type: "practice", completed: false },
      { name: "AWS Well-Architected Framework", type: "docs", url: "https://aws.amazon.com/architecture/well-architected/", completed: false },
    ],
    notes: "Strong on EC2, S3, VPC. Weak on advanced networking (Direct Connect, Transit Gateway) and database migration scenarios.",
  },
  {
    id: 2,
    name: "Google Data Analytics Certificate",
    provider: "Google / Coursera",
    category: "data",
    level: "Foundational",
    status: "completed",
    progress: 100,
    targetHours: 40,
    studiedHours: 38,
    completedDate: "2026-04-12",
    score: 94,
    resources: [
      { name: "Google Data Analytics Coursera Specialization", type: "course", completed: true },
      { name: "Foundations: Data, Data, Everywhere", type: "course", completed: true },
    ],
    notes: "Completed all 8 courses. Strong foundation in SQL, Tableau, R basics, and data lifecycle.",
  },
  {
    id: 3,
    name: "TensorFlow Developer Certificate",
    provider: "Google",
    category: "ai_ml",
    level: "Professional",
    status: "planned",
    progress: 0,
    targetHours: 60,
    studiedHours: 0,
    resources: [
      { name: "DeepLearning.AI TF Specialization", type: "course", completed: false },
      { name: "TensorFlow Official Tutorials", type: "docs", completed: false },
    ],
    notes: "Plan to start after AWS SAA exam. Focus: CNNs, NLP, Time Series, Deployment.",
  },
  {
    id: 4,
    name: "Meta Database Engineer Certificate",
    provider: "Meta / Coursera",
    category: "database",
    level: "Professional",
    status: "planned",
    progress: 0,
    targetHours: 50,
    studiedHours: 0,
    resources: [
      { name: "Meta Database Engineer Coursera Path", type: "course", completed: false },
    ],
    notes: "Advanced SQL, database design, stored procedures, Python + MySQL integration.",
  },
  {
    id: 5,
    name: "Python Institute PCEP",
    provider: "Python Institute",
    category: "programming",
    level: "Entry",
    status: "completed",
    progress: 100,
    targetHours: 20,
    studiedHours: 18,
    completedDate: "2026-01-20",
    score: 88,
    resources: [
      { name: "Python Institute Official Materials", type: "docs", completed: true },
    ],
    notes: "Entry-level Python certification. Good foundation before tackling Django/FastAPI.",
  },
];

// ── Styles ────────────────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<CertCategory, { label: string; bg: string; text: string; dot: string }> = {
  cloud:       { label: "Cloud",       bg: "bg-blue-900/20",      text: "text-blue-400",       dot: "#60a5fa" },
  data:        { label: "Data",        bg: "bg-[#AABAAE]/15",     text: "text-[#AABAAE]",      dot: "#AABAAE" },
  programming: { label: "Programming", bg: "bg-[#933B5B]/15",     text: "text-[#933B5B]",      dot: "#933B5B" },
  ai_ml:       { label: "AI / ML",     bg: "bg-amber-900/20",     text: "text-amber-400/80",   dot: "#f59e0b" },
  security:    { label: "Security",    bg: "bg-red-900/20",       text: "text-red-400/80",     dot: "#f87171" },
  database:    { label: "Database",    bg: "bg-purple-900/20",    text: "text-purple-400/80",  dot: "#c084fc" },
};

const STATUS_STYLES: Record<CertStatus, { label: string; badge: string; dot: string }> = {
  planned:     { label: "Planned",     badge: "bg-[#E3D6BF]/10 text-[#E3D6BF]/60",   dot: "#E3D6BF" },
  in_progress: { label: "In Progress", badge: "bg-[#AABAAE]/15 text-[#AABAAE]",       dot: "#AABAAE" },
  completed:   { label: "Completed",   badge: "bg-green-900/25 text-green-400",        dot: "#4ade80" },
};

const RESOURCE_ICONS: Record<Resource["type"], React.ElementType> = {
  course:   BookOpen,
  book:     BookOpen,
  practice: Target,
  docs:     ExternalLink,
};

// ── Study Plan Modal ──────────────────────────────────────────────────────────

function StudyPlanModal({
  cert,
  onClose,
}: {
  cert: Certification;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    currentLevel: "beginner",
    hoursPerDay: "2",
    examDate: cert.examDate ?? "",
  });
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openPhase, setOpenPhase] = useState<number | null>(0);

  async function handleGenerate() {
    setLoading(true);
    setPlan(null);
    setError(null);
    try {
      const res = await fetch("/api/ai/cert-roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certification: cert.name,
          provider: cert.provider,
          currentLevel: form.currentLevel,
          hoursPerDay: Number(form.hoursPerDay),
          examDate: form.examDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPlan(data.plan as StudyPlan);
      setOpenPhase(0);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: "rgba(21,13,17,0.88)", backdropFilter: "blur(6px)" }}>
      <div className="bg-[#150D11] rounded-2xl w-full max-w-2xl border border-[#E3D6BF]/10 p-6 my-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-xl font-light text-[#E3D6BF]" style={{ fontFamily: "var(--font-cormorant)" }}>AI Study Plan</h3>
            <p className="text-xs text-[#E3D6BF]/50 mt-0.5" style={{ fontFamily: "var(--font-dm-sans)" }}>{cert.name}</p>
          </div>
          <button onClick={onClose} className="text-[#E3D6BF]/40 hover:text-[#E3D6BF]/80 transition-colors"><X size={18} /></button>
        </div>

        {!plan && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Current level</label>
                <select value={form.currentLevel} onChange={e => setForm(f => ({ ...f, currentLevel: e.target.value }))} className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none">
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Hours per day</label>
                <select value={form.hoursPerDay} onChange={e => setForm(f => ({ ...f, hoursPerDay: e.target.value }))} className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none">
                  {["1", "1.5", "2", "3", "4"].map(h => <option key={h} value={h}>{h} hr{Number(h) !== 1 ? "s" : ""}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Exam date (optional)</label>
                <input type="date" value={form.examDate} onChange={e => setForm(f => ({ ...f, examDate: e.target.value }))} className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none" />
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-xs text-[#933B5B] bg-[#933B5B]/10 border border-[#933B5B]/20 rounded-xl px-3 py-2">
                <AlertCircle size={12} /> {error}
              </div>
            )}
            <button onClick={handleGenerate} disabled={loading} className="w-full py-2.5 rounded-xl bg-[#933B5B]/20 text-[#933B5B] hover:bg-[#933B5B]/30 disabled:opacity-50 transition-all border border-[#933B5B]/20 text-sm font-medium flex items-center justify-center gap-2" style={{ fontFamily: "var(--font-dm-sans)" }}>
              {loading ? <><Loader2 size={14} className="animate-spin" /> Generating plan...</> : <><Sparkles size={14} /> Generate Study Plan</>}
            </button>
          </div>
        )}

        {plan && (
          <div className="space-y-5">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Phases", value: plan.phases.length },
                { label: "Total weeks", value: plan.totalWeeks },
                { label: "Total hours", value: plan.totalHours },
              ].map((s) => (
                <div key={s.label} className="bg-[#1E1118]/40 rounded-xl p-3 text-center">
                  <p className="text-2xl font-light text-[#E3D6BF]" style={{ fontFamily: "var(--font-cormorant)" }}>{s.value}</p>
                  <p className="text-xs text-[#E3D6BF]/50" style={{ fontFamily: "var(--font-dm-sans)" }}>{s.label}</p>
                </div>
              ))}
            </div>
            <div className="bg-[#933B5B]/10 border border-[#933B5B]/20 rounded-xl px-4 py-2.5">
              <p className="text-xs text-[#933B5B]" style={{ fontFamily: "var(--font-dm-sans)" }}>{plan.dailySchedule}</p>
            </div>

            {/* Phases */}
            <div className="space-y-2">
              {plan.phases.map((phase, i) => (
                <div key={i} className="bg-[#1E1118]/30 rounded-xl border border-[#E3D6BF]/8 overflow-hidden">
                  <button onClick={() => setOpenPhase(openPhase === i ? null : i)} className="w-full text-left p-3.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                    <span className="w-7 h-7 rounded-lg bg-[#933B5B]/15 text-[#933B5B] text-xs font-medium flex items-center justify-center shrink-0" style={{ fontFamily: "var(--font-dm-sans)" }}>P{phase.phaseNumber}</span>
                    <div className="flex-1">
                      <p className="text-sm text-[#E3D6BF]/90" style={{ fontFamily: "var(--font-dm-sans)" }}>{phase.title}</p>
                      <p className="text-xs text-[#E3D6BF]/40" style={{ fontFamily: "var(--font-dm-sans)" }}>{phase.weeks} · {phase.hoursRequired}h{phase.practiceTests ? " · Practice tests" : ""}</p>
                    </div>
                    <ChevronDown size={14} className={cn("text-[#E3D6BF]/30 shrink-0 transition-transform duration-200", openPhase === i && "rotate-180")} />
                  </button>
                  {openPhase === i && (
                    <div className="px-4 pb-4 pt-0 border-t border-[#E3D6BF]/5 space-y-3 mt-0">
                      <div>
                        <p className="text-xs text-[#AABAAE] mb-1 mt-3" style={{ fontFamily: "var(--font-dm-sans)" }}>Topics</p>
                        <div className="flex flex-wrap gap-1.5">
                          {phase.topics.map((t) => <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-[#AABAAE]/10 text-[#AABAAE]/80 border border-[#AABAAE]/20" style={{ fontFamily: "var(--font-dm-sans)" }}>{t}</span>)}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-[#AABAAE] mb-1" style={{ fontFamily: "var(--font-dm-sans)" }}>Weekly goals</p>
                        {phase.goals.map((g) => <p key={g} className="text-xs text-[#E3D6BF]/60 flex items-start gap-1.5 mb-1" style={{ fontFamily: "var(--font-dm-sans)" }}><ChevronRight size={10} className="mt-0.5 text-[#933B5B] shrink-0" />{g}</p>)}
                      </div>
                      {phase.resources.length > 0 && (
                        <div>
                          <p className="text-xs text-[#AABAAE] mb-1" style={{ fontFamily: "var(--font-dm-sans)" }}>Resources</p>
                          {phase.resources.map((r) => <p key={r} className="text-xs text-[#E3D6BF]/50 flex items-start gap-1.5 mb-1" style={{ fontFamily: "var(--font-dm-sans)" }}><BookOpen size={10} className="mt-0.5 text-[#E3D6BF]/30 shrink-0" />{r}</p>)}
                        </div>
                      )}
                      {phase.milestone && (
                        <div className="bg-[#933B5B]/10 border border-[#933B5B]/20 rounded-lg px-3 py-2">
                          <p className="text-xs text-[#933B5B]" style={{ fontFamily: "var(--font-dm-sans)" }}>Milestone: {phase.milestone}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Readiness checklist */}
            <div>
              <p className="text-xs text-[#AABAAE] mb-2" style={{ fontFamily: "var(--font-dm-sans)" }}>Exam readiness checklist</p>
              {plan.examReadinessChecklist.map((item) => (
                <div key={item} className="flex items-start gap-2 mb-1.5">
                  <div className="w-4 h-4 rounded border border-[#E3D6BF]/20 mt-0.5 shrink-0" />
                  <p className="text-xs text-[#E3D6BF]/60" style={{ fontFamily: "var(--font-dm-sans)" }}>{item}</p>
                </div>
              ))}
            </div>

            {/* Tips */}
            <div className="space-y-1.5">
              <p className="text-xs text-[#AABAAE]" style={{ fontFamily: "var(--font-dm-sans)" }}>Tips</p>
              {plan.tips.map((tip) => (
                <p key={tip} className="text-xs text-[#E3D6BF]/50 flex items-start gap-1.5" style={{ fontFamily: "var(--font-dm-sans)" }}>
                  <Sparkles size={10} className="mt-0.5 text-[#933B5B] shrink-0" />
                  {tip}
                </p>
              ))}
            </div>

            <button onClick={() => { setPlan(null); setError(null); }} className="text-xs text-[#E3D6BF]/40 hover:text-[#E3D6BF]/70 transition-colors" style={{ fontFamily: "var(--font-dm-sans)" }}>← Regenerate with different settings</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add Cert Modal ────────────────────────────────────────────────────────────

function AddCertModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (cert: Certification) => void;
}) {
  const [form, setForm] = useState({
    name: "", provider: "", category: "cloud" as CertCategory,
    level: "Associate", status: "planned" as CertStatus,
    targetHours: "40", examDate: "", notes: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onAdd({
      id: Date.now(),
      name: form.name,
      provider: form.provider,
      category: form.category,
      level: form.level,
      status: form.status,
      progress: 0,
      targetHours: Number(form.targetHours),
      studiedHours: 0,
      examDate: form.examDate || undefined,
      resources: [],
      notes: form.notes,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(21,13,17,0.85)", backdropFilter: "blur(4px)" }}>
      <div className="bg-[#150D11] rounded-2xl w-full max-w-lg border border-[#E3D6BF]/10 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-light text-[#E3D6BF]" style={{ fontFamily: "var(--font-cormorant)" }}>Add Certification</h3>
          <button onClick={onClose} className="text-[#E3D6BF]/40 hover:text-[#E3D6BF]/80 transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Certification name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="AWS Solutions Architect Associate" className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none" style={{ fontFamily: "var(--font-dm-sans)" }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Provider</label>
              <input value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} placeholder="Amazon Web Services" className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none" style={{ fontFamily: "var(--font-dm-sans)" }} />
            </div>
            <div>
              <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Level</label>
              <input value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} placeholder="Associate / Professional" className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none" style={{ fontFamily: "var(--font-dm-sans)" }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as CertCategory }))} className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none">
                {Object.entries(CATEGORY_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as CertStatus }))} className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none">
                <option value="planned">Planned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Target study hours</label>
              <input type="number" value={form.targetHours} onChange={e => setForm(f => ({ ...f, targetHours: e.target.value }))} min="1" className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Exam date (optional)</label>
              <input type="date" value={form.examDate} onChange={e => setForm(f => ({ ...f, examDate: e.target.value }))} className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Weak areas, motivation, next steps..." className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none resize-none" style={{ fontFamily: "var(--font-dm-sans)" }} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#E3D6BF]/50 hover:text-[#E3D6BF]/80 transition-colors" style={{ fontFamily: "var(--font-dm-sans)" }}>Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-[#933B5B]/20 text-[#933B5B] hover:bg-[#933B5B]/30 transition-all border border-[#933B5B]/20" style={{ fontFamily: "var(--font-dm-sans)" }}>Add Certification</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Cert Card ────────────────────────────────────────────────────────────────

function CertCard({
  cert,
  onStudyPlan,
}: {
  cert: Certification;
  onStudyPlan: (cert: Certification) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const catStyle = CATEGORY_STYLES[cert.category];
  const statusStyle = STATUS_STYLES[cert.status];
  const hoursPercent = cert.targetHours > 0 ? Math.min((cert.studiedHours / cert.targetHours) * 100, 100) : 0;

  return (
    <div className={cn("bg-[#150D11] rounded-xl border overflow-hidden transition-all", cert.status === "in_progress" ? "border-[#AABAAE]/25" : "border-[#E3D6BF]/8")}>
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left p-4 hover:bg-white/[0.02] transition-colors">
        <div className="flex items-start gap-3">
          {/* Category dot + icon */}
          <div className={cn("p-2.5 rounded-xl shrink-0 mt-0.5", catStyle.bg)}>
            {cert.status === "completed"
              ? <Trophy size={16} className={catStyle.text} />
              : <GraduationCap size={16} className={catStyle.text} />
            }
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#E3D6BF]/90 leading-snug" style={{ fontFamily: "var(--font-dm-sans)" }}>{cert.name}</p>
                <p className="text-xs text-[#E3D6BF]/40 mt-0.5" style={{ fontFamily: "var(--font-dm-sans)" }}>{cert.provider} · {cert.level}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn("text-xs px-2 py-0.5 rounded-full border-transparent", catStyle.bg, catStyle.text)} style={{ fontFamily: "var(--font-dm-sans)" }}>{catStyle.label}</span>
                <span className={cn("text-xs px-2 py-0.5 rounded-full", statusStyle.badge)} style={{ fontFamily: "var(--font-dm-sans)" }}>{statusStyle.label}</span>
              </div>
            </div>

            {/* Progress bar */}
            {cert.status !== "planned" && (
              <div className="mt-2.5">
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-[#E3D6BF]/40" style={{ fontFamily: "var(--font-dm-sans)" }}>{cert.studiedHours}h studied</span>
                  <span className="text-xs text-[#E3D6BF]/40" style={{ fontFamily: "var(--font-dm-sans)" }}>{cert.status === "completed" ? `Score: ${cert.score ?? "–"}%` : `${cert.targetHours}h target`}</span>
                </div>
                <div className="h-1.5 bg-[#E3D6BF]/8 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", cert.status === "completed" ? "bg-green-500" : "bg-[#933B5B]")}
                    style={{ width: `${cert.status === "completed" ? 100 : hoursPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Exam date / completed date */}
            {(cert.examDate || cert.completedDate) && (
              <div className="flex items-center gap-1.5 mt-2">
                <Clock size={10} className="text-[#E3D6BF]/30" />
                <span className="text-xs text-[#E3D6BF]/40" style={{ fontFamily: "var(--font-dm-sans)" }}>
                  {cert.completedDate ? `Completed ${cert.completedDate}` : `Exam: ${cert.examDate}`}
                </span>
              </div>
            )}
          </div>

          <ChevronDown size={14} className={cn("text-[#E3D6BF]/30 shrink-0 mt-1 transition-transform duration-200", expanded && "rotate-180")} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[#E3D6BF]/5 pt-3 space-y-4">
          {cert.notes && (
            <p className="text-sm text-[#E3D6BF]/55 leading-relaxed" style={{ fontFamily: "var(--font-dm-sans)" }}>{cert.notes}</p>
          )}

          {cert.resources.length > 0 && (
            <div>
              <p className="text-xs text-[#AABAAE] mb-2" style={{ fontFamily: "var(--font-dm-sans)" }}>Resources</p>
              <div className="space-y-1.5">
                {cert.resources.map((r, i) => {
                  const Icon = RESOURCE_ICONS[r.type];
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", r.completed ? "bg-[#AABAAE] border-[#AABAAE]" : "border-[#E3D6BF]/20")}>
                        {r.completed && <Check size={9} strokeWidth={3} className="text-[#150D11]" />}
                      </div>
                      <Icon size={11} className="text-[#E3D6BF]/30 shrink-0" />
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className={cn("text-xs hover:text-[#AABAAE] transition-colors flex items-center gap-1", r.completed ? "text-[#E3D6BF]/30 line-through" : "text-[#E3D6BF]/60")} style={{ fontFamily: "var(--font-dm-sans)" }}>
                          {r.name} <ExternalLink size={9} />
                        </a>
                      ) : (
                        <span className={cn("text-xs", r.completed ? "text-[#E3D6BF]/30 line-through" : "text-[#E3D6BF]/60")} style={{ fontFamily: "var(--font-dm-sans)" }}>{r.name}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={() => onStudyPlan(cert)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#933B5B]/15 text-[#933B5B] hover:bg-[#933B5B]/25 transition-all border border-[#933B5B]/20 text-xs"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            <Sparkles size={12} /> Generate AI Study Plan
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SkillsPage() {
  const [certs, setCerts] = useState<Certification[]>(INITIAL_CERTS);
  const [catFilter, setCatFilter] = useState<CertCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<CertStatus | "all">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [studyPlanCert, setStudyPlanCert] = useState<Certification | null>(null);

  const stats = useMemo(() => ({
    total: certs.length,
    completed: certs.filter((c) => c.status === "completed").length,
    inProgress: certs.filter((c) => c.status === "in_progress").length,
    totalHours: certs.reduce((acc, c) => acc + c.studiedHours, 0),
  }), [certs]);

  const filtered = useMemo(() => {
    let result = certs;
    if (catFilter !== "all") result = result.filter((c) => c.category === catFilter);
    if (statusFilter !== "all") result = result.filter((c) => c.status === statusFilter);
    return result;
  }, [certs, catFilter, statusFilter]);

  return (
    <div className="space-y-6 fade-in">
      {showAdd && <AddCertModal onClose={() => setShowAdd(false)} onAdd={(cert) => setCerts((p) => [cert, ...p])} />}
      {studyPlanCert && <StudyPlanModal cert={studyPlanCert} onClose={() => setStudyPlanCert(null)} />}

      {/* Header */}
      <div>
        <p className="text-xs font-medium tracking-[0.1em] uppercase text-[#AABAAE]/70 mb-1" style={{ fontFamily: "var(--font-dm-sans)" }}>Module 8</p>
        <h1 className="text-4xl font-light text-[#E3D6BF]" style={{ fontFamily: "var(--font-cormorant)" }}>Skill Building</h1>
        <p className="text-sm text-[#E3D6BF]/50 mt-1" style={{ fontFamily: "var(--font-dm-sans)" }}>Track certifications, generate AI study plans, and measure progress.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total certs", value: stats.total, icon: GraduationCap },
          { label: "Completed", value: stats.completed, icon: Trophy },
          { label: "In progress", value: stats.inProgress, icon: Target },
          { label: "Hours studied", value: `${stats.totalHours}h`, icon: Clock },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-[#150D11] rounded-xl p-4 border border-[#E3D6BF]/8 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#933B5B]/12 shrink-0">
                <Icon size={16} className="text-[#933B5B]" />
              </div>
              <div>
                <p className="text-2xl font-light text-[#E3D6BF] leading-none" style={{ fontFamily: "var(--font-cormorant)" }}>{s.value}</p>
                <p className="text-xs text-[#E3D6BF]/40 mt-0.5" style={{ fontFamily: "var(--font-dm-sans)" }}>{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters + Add */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex flex-wrap gap-2">
          {/* Category filters */}
          <button
            onClick={() => setCatFilter("all")}
            className={cn("px-3 py-1.5 rounded-lg text-xs border transition-all", catFilter === "all" ? "bg-[#1E1118] text-[#E3D6BF] border-[#E3D6BF]/20" : "border-[#E3D6BF]/10 text-[#E3D6BF]/40 hover:text-[#E3D6BF]/70")}
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            All
          </button>
          {(Object.entries(CATEGORY_STYLES) as [CertCategory, typeof CATEGORY_STYLES[CertCategory]][]).map(([cat, style]) => (
            certs.some((c) => c.category === cat) && (
              <button
                key={cat}
                onClick={() => setCatFilter(cat === catFilter ? "all" : cat)}
                className={cn("px-3 py-1.5 rounded-lg text-xs border transition-all flex items-center gap-1.5", catFilter === cat ? `${style.bg} ${style.text} border-transparent` : "border-[#E3D6BF]/10 text-[#E3D6BF]/40 hover:text-[#E3D6BF]/70")}
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.dot }} />
                {style.label}
              </button>
            )
          ))}

          {/* Status filter divider */}
          <span className="text-[#E3D6BF]/20 self-center">|</span>

          {(Object.entries(STATUS_STYLES) as [CertStatus, typeof STATUS_STYLES[CertStatus]][]).map(([s, style]) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s === statusFilter ? "all" : s)}
              className={cn("px-3 py-1.5 rounded-lg text-xs border transition-all", statusFilter === s ? `${style.badge} border-transparent` : "border-[#E3D6BF]/10 text-[#E3D6BF]/40 hover:text-[#E3D6BF]/70")}
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              {style.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#933B5B]/20 text-[#933B5B] hover:bg-[#933B5B]/30 transition-all border border-[#933B5B]/20 text-sm shrink-0"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          <Plus size={14} /> Add Certification
        </button>
      </div>

      {/* Cert list */}
      <div className="space-y-2">
        {filtered.map((cert) => (
          <CertCard key={cert.id} cert={cert} onStudyPlan={setStudyPlanCert} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-[#E3D6BF]/30 text-sm" style={{ fontFamily: "var(--font-dm-sans)" }}>
            No certifications match this filter.
          </div>
        )}
      </div>
    </div>
  );
}
