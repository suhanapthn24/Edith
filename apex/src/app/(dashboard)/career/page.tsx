"use client";

import { useState, useMemo } from "react";
import {
  Briefcase, Plus, X, ChevronDown, ExternalLink, Copy, Check,
  Loader2, Sparkles, AlertCircle, FileText, Users, MessageSquare,
  MapPin, Clock, DollarSign, Star, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type AppStatus =
  | "applied"
  | "screening"
  | "technical"
  | "offer"
  | "rejected"
  | "withdrawn";
type AppType = "full-time" | "internship" | "contract" | "co-op";
type CareerTab = "applications" | "resume" | "interview" | "coverletter";
type QCategory = "behavioral" | "technical" | "system-design" | "hr";

interface Application {
  id: number;
  company: string;
  role: string;
  location: string;
  remote: boolean;
  type: AppType;
  status: AppStatus;
  appliedDate: string;
  salary?: string;
  url?: string;
  notes: string;
  nextStep?: string;
}

interface ResumeVersion {
  id: number;
  name: string;
  targetRole: string;
  tailoredFor?: string;
  lastUpdated: string;
  tags: string[];
  isDefault: boolean;
}

interface InterviewQuestion {
  id: number;
  question: string;
  category: QCategory;
  difficulty: "easy" | "medium" | "hard";
  notes: string;
  practiced: boolean;
}

// ── Mock data ────────────────────────────────────────────────────────────────

const INITIAL_APPS: Application[] = [
  { id: 1, company: "Google", role: "Software Engineer Intern", location: "Bangalore, IN", remote: false, type: "internship", status: "technical", appliedDate: "2026-06-01", salary: "₹80k/mo", url: "https://careers.google.com", notes: "L3 internship. Got recruiter screen — next is 2x coding rounds.", nextStep: "Technical interview on Jun 22" },
  { id: 2, company: "Microsoft", role: "SWE Intern (Azure)", location: "Hyderabad, IN", remote: false, type: "internship", status: "screening", appliedDate: "2026-06-05", salary: "₹75k/mo", notes: "Applied through campus referral from alumni.", nextStep: "HR call pending" },
  { id: 3, company: "Razorpay", role: "Product Analyst", location: "Bangalore, IN", remote: true, type: "full-time", status: "applied", appliedDate: "2026-06-12", salary: "₹12-16 LPA", notes: "Business analytics role — data, SQL, product thinking." },
  { id: 4, company: "Zepto", role: "Data Analyst Intern", location: "Mumbai, IN", remote: false, type: "internship", status: "offer", appliedDate: "2026-05-20", salary: "₹45k/mo", notes: "Got offer! Deciding between this and Google.", nextStep: "Decision deadline Jun 25" },
  { id: 5, company: "Flipkart", role: "SDE Intern", location: "Bangalore, IN", remote: false, type: "internship", status: "rejected", appliedDate: "2026-05-10", notes: "Rejected after OA. Weak on DP problems — focus area." },
];

const INITIAL_RESUMES: ResumeVersion[] = [
  { id: 1, name: "Master Resume", targetRole: "Software Engineer", tailoredFor: undefined, lastUpdated: "2026-06-14", tags: ["general", "full-stack", "python"], isDefault: true },
  { id: 2, name: "SWE Internship — India Tech", targetRole: "SWE Intern", tailoredFor: "Google / Microsoft", lastUpdated: "2026-06-01", tags: ["internship", "dsa", "java"], isDefault: false },
  { id: 3, name: "Data / Analytics Focus", targetRole: "Data Analyst / Product Analyst", tailoredFor: "Razorpay / Zepto", lastUpdated: "2026-06-10", tags: ["analytics", "sql", "python", "bi"], isDefault: false },
  { id: 4, name: "AI / ML Research", targetRole: "ML Intern / Research", tailoredFor: "Research labs, AI startups", lastUpdated: "2026-05-28", tags: ["ml", "pytorch", "research", "llm"], isDefault: false },
];

const INITIAL_QUESTIONS: InterviewQuestion[] = [
  { id: 1, question: "Tell me about a time you handled a conflict with a teammate.", category: "behavioral", difficulty: "medium", notes: "STAR method: Project X, disagreement on architecture approach, compromise reached, shipped on time.", practiced: true },
  { id: 2, question: "Design a URL shortener like bit.ly.", category: "system-design", difficulty: "medium", notes: "Base62 encoding, hash collisions, custom aliases, analytics, cache with Redis, CDN for redirect speed.", practiced: false },
  { id: 3, question: "Implement LRU Cache.", category: "technical", difficulty: "medium", notes: "HashMap + doubly linked list. O(1) get and put. Python: OrderedDict shortcut.", practiced: true },
  { id: 4, question: "Where do you see yourself in 5 years?", category: "hr", difficulty: "easy", notes: "Software engineer with product ownership. Building AI-powered tools. Eventually, founding something.", practiced: false },
  { id: 5, question: "Find all subsets of an array.", category: "technical", difficulty: "medium", notes: "Backtracking: O(2^n). Iterative bitmask approach. Handle duplicates with sort + skip.", practiced: true },
  { id: 6, question: "Design a notification system for 1 billion users.", category: "system-design", difficulty: "hard", notes: "Fanout approaches, pub/sub with Kafka, priority queues, rate limiting, push vs pull, delivery receipts.", practiced: false },
  { id: 7, question: "Why do you want to work at [Company]?", category: "hr", difficulty: "easy", notes: "Be specific — research actual products/initiatives. Avoid generic 'innovative' and 'exciting'.", practiced: true },
];

// ── Styles ────────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<AppStatus, { label: string; dot: string; badge: string }> = {
  applied:   { label: "Applied",    dot: "#E3D6BF", badge: "bg-[#E3D6BF]/10 text-[#E3D6BF]/70"   },
  screening: { label: "Screening",  dot: "#AABAAE", badge: "bg-[#AABAAE]/15 text-[#AABAAE]"       },
  technical: { label: "Technical",  dot: "#933B5B", badge: "bg-[#933B5B]/15 text-[#933B5B]"       },
  offer:     { label: "Offer",      dot: "#4ade80", badge: "bg-green-900/25 text-green-400"        },
  rejected:  { label: "Rejected",   dot: "#ef4444", badge: "bg-red-900/20 text-red-400/80"         },
  withdrawn: { label: "Withdrawn",  dot: "#6b7280", badge: "bg-white/5 text-[#E3D6BF]/30"          },
};

const Q_CATEGORY_STYLES: Record<QCategory, { label: string; badge: string }> = {
  behavioral:    { label: "Behavioral",    badge: "bg-[#AABAAE]/15 text-[#AABAAE]"     },
  technical:     { label: "Technical",     badge: "bg-[#933B5B]/15 text-[#933B5B]"     },
  "system-design": { label: "System Design", badge: "bg-blue-900/20 text-blue-400"     },
  hr:            { label: "HR / Culture",  badge: "bg-[#E3D6BF]/10 text-[#E3D6BF]/60"  },
};

const DIFF_STYLES: Record<string, string> = {
  easy:   "text-[#AABAAE]",
  medium: "text-[#E3D6BF]/70",
  hard:   "text-[#933B5B]",
};

// ── Add Application Modal ────────────────────────────────────────────────────

function AddAppModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (app: Application) => void;
}) {
  const [form, setForm] = useState({
    company: "", role: "", location: "", remote: false,
    type: "internship" as AppType, status: "applied" as AppStatus,
    appliedDate: new Date().toISOString().slice(0, 10),
    salary: "", url: "", notes: "", nextStep: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company.trim() || !form.role.trim()) return;
    onAdd({ id: Date.now(), ...form, salary: form.salary || undefined, url: form.url || undefined, nextStep: form.nextStep || undefined });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: "rgba(21,13,17,0.85)", backdropFilter: "blur(4px)" }}>
      <div className="bg-[#150D11] rounded-2xl w-full max-w-xl border border-[#E3D6BF]/10 p-6 my-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-light text-[#E3D6BF]" style={{ fontFamily: "var(--font-cormorant)" }}>Add Application</h3>
          <button onClick={onClose} className="text-[#E3D6BF]/40 hover:text-[#E3D6BF]/80 transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Company *</label>
              <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} required placeholder="Google" className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none" style={{ fontFamily: "var(--font-dm-sans)" }} />
            </div>
            <div>
              <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Role *</label>
              <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} required placeholder="Software Engineer Intern" className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none" style={{ fontFamily: "var(--font-dm-sans)" }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as AppType }))} className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none">
                <option value="internship">Internship</option>
                <option value="full-time">Full-time</option>
                <option value="contract">Contract</option>
                <option value="co-op">Co-op</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as AppStatus }))} className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none">
                {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Location</label>
              <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Bangalore, IN" className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none" style={{ fontFamily: "var(--font-dm-sans)" }} />
            </div>
            <div>
              <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Salary / Stipend</label>
              <input value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} placeholder="₹80k/mo" className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none" style={{ fontFamily: "var(--font-dm-sans)" }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Date Applied</label>
              <input type="date" value={form.appliedDate} onChange={e => setForm(f => ({ ...f, appliedDate: e.target.value }))} className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none" />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.remote} onChange={e => setForm(f => ({ ...f, remote: e.target.checked }))} className="w-4 h-4 accent-[#933B5B]" />
                <span className="text-sm text-[#E3D6BF]/70" style={{ fontFamily: "var(--font-dm-sans)" }}>Remote</span>
              </label>
            </div>
          </div>
          <div>
            <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Job URL</label>
            <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none" style={{ fontFamily: "var(--font-dm-sans)" }} />
          </div>
          <div>
            <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Next step</label>
            <input value={form.nextStep} onChange={e => setForm(f => ({ ...f, nextStep: e.target.value }))} placeholder="Technical interview on Jun 22" className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none" style={{ fontFamily: "var(--font-dm-sans)" }} />
          </div>
          <div>
            <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Referral source, context, key requirements..." className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none resize-none" style={{ fontFamily: "var(--font-dm-sans)" }} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#E3D6BF]/50 hover:text-[#E3D6BF]/80 transition-colors" style={{ fontFamily: "var(--font-dm-sans)" }}>Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-[#933B5B]/20 text-[#933B5B] hover:bg-[#933B5B]/30 transition-all border border-[#933B5B]/20" style={{ fontFamily: "var(--font-dm-sans)" }}>Add Application</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Applications Tab ──────────────────────────────────────────────────────────

function ApplicationsTab({
  apps,
  onAdd,
  onDelete,
  onStatusChange,
}: {
  apps: Application[];
  onAdd: (app: Application) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: AppStatus) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<AppStatus | "all">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const filtered = useMemo(
    () => (statusFilter === "all" ? apps : apps.filter((a) => a.status === statusFilter)),
    [apps, statusFilter]
  );

  const counts = useMemo(
    () =>
      (Object.keys(STATUS_STYLES) as AppStatus[]).reduce(
        (acc, s) => ({ ...acc, [s]: apps.filter((a) => a.status === s).length }),
        {} as Record<AppStatus, number>
      ),
    [apps]
  );

  return (
    <>
      {showAdd && <AddAppModal onClose={() => setShowAdd(false)} onAdd={onAdd} />}
      <div className="space-y-4">
        {/* Filter + Add row */}
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setStatusFilter("all")}
              className={cn("px-3 py-1.5 rounded-lg text-xs border transition-all", statusFilter === "all" ? "bg-[#1E1118] text-[#E3D6BF] border-[#E3D6BF]/20" : "border-[#E3D6BF]/10 text-[#E3D6BF]/40 hover:text-[#E3D6BF]/70")}
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              All ({apps.length})
            </button>
            {(Object.entries(STATUS_STYLES) as [AppStatus, typeof STATUS_STYLES[AppStatus]][]).map(([s, style]) => (
              counts[s] > 0 && (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s === statusFilter ? "all" : s)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs border transition-all flex items-center gap-1.5", statusFilter === s ? `${style.badge} border-transparent` : "border-[#E3D6BF]/10 text-[#E3D6BF]/40 hover:text-[#E3D6BF]/70")}
                  style={{ fontFamily: "var(--font-dm-sans)" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: style.dot }} />
                  {style.label} ({counts[s]})
                </button>
              )
            ))}
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#933B5B]/20 text-[#933B5B] hover:bg-[#933B5B]/30 transition-all border border-[#933B5B]/20 text-sm"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            <Plus size={14} /> Add Application
          </button>
        </div>

        {/* Applications list */}
        <div className="space-y-2">
          {filtered.map((app) => {
            const style = STATUS_STYLES[app.status];
            const isExpanded = expanded === app.id;
            return (
              <div key={app.id} className="bg-[#150D11] rounded-xl border border-[#E3D6BF]/8 overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : app.id)}
                  className="w-full text-left p-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: style.dot }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[#E3D6BF]/90" style={{ fontFamily: "var(--font-dm-sans)" }}>{app.company}</span>
                      <span className="text-xs text-[#E3D6BF]/40" style={{ fontFamily: "var(--font-dm-sans)" }}>·</span>
                      <span className="text-sm text-[#E3D6BF]/60" style={{ fontFamily: "var(--font-dm-sans)" }}>{app.role}</span>
                      <span className={cn("ml-auto text-xs px-2 py-0.5 rounded-full", style.badge)} style={{ fontFamily: "var(--font-dm-sans)" }}>{style.label}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-[#E3D6BF]/40" style={{ fontFamily: "var(--font-dm-sans)" }}><MapPin size={10} />{app.location}{app.remote ? " · Remote" : ""}</span>
                      <span className="flex items-center gap-1 text-xs text-[#E3D6BF]/40" style={{ fontFamily: "var(--font-dm-sans)" }}><Clock size={10} />{app.appliedDate}</span>
                      {app.salary && <span className="flex items-center gap-1 text-xs text-[#E3D6BF]/40" style={{ fontFamily: "var(--font-dm-sans)" }}><DollarSign size={10} />{app.salary}</span>}
                    </div>
                  </div>
                  <ChevronDown size={14} className={cn("text-[#E3D6BF]/30 shrink-0 transition-transform duration-200", isExpanded && "rotate-180")} />
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-[#E3D6BF]/5 pt-3 space-y-3">
                    {app.notes && (
                      <p className="text-sm text-[#E3D6BF]/60 leading-relaxed" style={{ fontFamily: "var(--font-dm-sans)" }}>{app.notes}</p>
                    )}
                    {app.nextStep && (
                      <div className="flex items-center gap-2 bg-[#933B5B]/10 border border-[#933B5B]/20 rounded-lg px-3 py-2">
                        <Star size={12} className="text-[#933B5B]" />
                        <span className="text-xs text-[#933B5B]" style={{ fontFamily: "var(--font-dm-sans)" }}>{app.nextStep}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={app.status}
                        onChange={(e) => onStatusChange(app.id, e.target.value as AppStatus)}
                        className="text-xs bg-[#1E1118]/60 rounded-lg px-2 py-1.5 text-[#E3D6BF]/70 border border-[#E3D6BF]/10 focus:outline-none"
                      >
                        {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                      {app.url && (
                        <a href={app.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#AABAAE] hover:text-[#AABAAE]/80 transition-colors" style={{ fontFamily: "var(--font-dm-sans)" }}>
                          <ExternalLink size={11} /> View posting
                        </a>
                      )}
                      <button onClick={() => onDelete(app.id)} className="ml-auto flex items-center gap-1 text-xs text-[#E3D6BF]/30 hover:text-red-400/70 transition-colors" style={{ fontFamily: "var(--font-dm-sans)" }}>
                        <Trash2 size={11} /> Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-[#E3D6BF]/30 text-sm" style={{ fontFamily: "var(--font-dm-sans)" }}>No applications here.</div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Resume Tab ────────────────────────────────────────────────────────────────

function ResumeTab({ versions }: { versions: ResumeVersion[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#E3D6BF]/60" style={{ fontFamily: "var(--font-dm-sans)" }}>{versions.length} resume versions</p>
        <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#933B5B]/20 text-[#933B5B] hover:bg-[#933B5B]/30 transition-all border border-[#933B5B]/20 text-sm" style={{ fontFamily: "var(--font-dm-sans)" }}>
          <Plus size={14} /> New version
        </button>
      </div>
      <div className="grid gap-3">
        {versions.map((v) => (
          <div key={v.id} className="bg-[#150D11] rounded-xl border border-[#E3D6BF]/8 p-4 flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-[#933B5B]/12 shrink-0">
              <FileText size={18} className="text-[#933B5B]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 justify-between">
                <div>
                  <p className="text-sm font-medium text-[#E3D6BF]/90" style={{ fontFamily: "var(--font-dm-sans)" }}>{v.name}</p>
                  <p className="text-xs text-[#E3D6BF]/50 mt-0.5" style={{ fontFamily: "var(--font-dm-sans)" }}>{v.targetRole}{v.tailoredFor ? ` · ${v.tailoredFor}` : ""}</p>
                </div>
                {v.isDefault && <span className="text-xs px-2 py-0.5 rounded-full bg-[#AABAAE]/15 text-[#AABAAE] border border-[#AABAAE]/20 shrink-0" style={{ fontFamily: "var(--font-dm-sans)" }}>default</span>}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {v.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-[#1E1118]/80 text-[#E3D6BF]/50 border border-[#E3D6BF]/8" style={{ fontFamily: "var(--font-dm-sans)" }}>{tag}</span>
                ))}
              </div>
              <p className="text-xs text-[#E3D6BF]/30 mt-2" style={{ fontFamily: "var(--font-dm-sans)" }}>Updated {v.lastUpdated}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Interview Prep Tab ────────────────────────────────────────────────────────

function InterviewTab({
  questions,
  onToggle,
}: {
  questions: InterviewQuestion[];
  onToggle: (id: number) => void;
}) {
  const [catFilter, setCatFilter] = useState<QCategory | "all">("all");
  const [expanded, setExpanded] = useState<number | null>(null);

  const filtered = useMemo(
    () => (catFilter === "all" ? questions : questions.filter((q) => q.category === catFilter)),
    [questions, catFilter]
  );

  const practiced = questions.filter((q) => q.practiced).length;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="bg-[#150D11] rounded-xl p-4 border border-[#E3D6BF]/8">
        <div className="flex justify-between mb-2">
          <span className="text-xs text-[#E3D6BF]/60" style={{ fontFamily: "var(--font-dm-sans)" }}>Practice progress</span>
          <span className="text-xs font-medium text-[#E3D6BF]/80" style={{ fontFamily: "var(--font-dm-sans)" }}>{practiced} / {questions.length} practiced</span>
        </div>
        <div className="h-1.5 bg-[#E3D6BF]/10 rounded-full overflow-hidden">
          <div className="h-full bg-[#933B5B] rounded-full transition-all" style={{ width: `${questions.length ? (practiced / questions.length) * 100 : 0}%` }} />
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setCatFilter("all")} className={cn("px-3 py-1.5 rounded-lg text-xs border transition-all", catFilter === "all" ? "bg-[#1E1118] text-[#E3D6BF] border-[#E3D6BF]/20" : "border-[#E3D6BF]/10 text-[#E3D6BF]/40 hover:text-[#E3D6BF]/70")} style={{ fontFamily: "var(--font-dm-sans)" }}>All</button>
        {(Object.entries(Q_CATEGORY_STYLES) as [QCategory, typeof Q_CATEGORY_STYLES[QCategory]][]).map(([cat, style]) => (
          <button key={cat} onClick={() => setCatFilter(cat === catFilter ? "all" : cat)} className={cn("px-3 py-1.5 rounded-lg text-xs border transition-all", catFilter === cat ? `${style.badge} border-transparent` : "border-[#E3D6BF]/10 text-[#E3D6BF]/40 hover:text-[#E3D6BF]/70")} style={{ fontFamily: "var(--font-dm-sans)" }}>{style.label}</button>
        ))}
      </div>

      {/* Questions */}
      <div className="space-y-2">
        {filtered.map((q) => {
          const catStyle = Q_CATEGORY_STYLES[q.category];
          const isExpanded = expanded === q.id;
          return (
            <div key={q.id} className={cn("bg-[#150D11] rounded-xl border overflow-hidden transition-all", q.practiced ? "border-[#AABAAE]/20" : "border-[#E3D6BF]/8")}>
              <div className="p-4 flex items-start gap-3">
                <button
                  onClick={() => onToggle(q.id)}
                  className={cn("w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all", q.practiced ? "bg-[#AABAAE] border-[#AABAAE]" : "border-[#E3D6BF]/20 hover:border-[#AABAAE]/50")}
                >
                  {q.practiced && <Check size={11} strokeWidth={3} className="text-[#150D11]" />}
                </button>
                <button onClick={() => setExpanded(isExpanded ? null : q.id)} className="flex-1 text-left">
                  <p className={cn("text-sm leading-snug", q.practiced ? "text-[#E3D6BF]/50 line-through" : "text-[#E3D6BF]/90")} style={{ fontFamily: "var(--font-dm-sans)" }}>{q.question}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={cn("text-xs px-1.5 py-0.5 rounded", catStyle.badge)} style={{ fontFamily: "var(--font-dm-sans)" }}>{catStyle.label}</span>
                    <span className={cn("text-xs capitalize", DIFF_STYLES[q.difficulty])} style={{ fontFamily: "var(--font-dm-sans)" }}>{q.difficulty}</span>
                  </div>
                </button>
                <ChevronDown size={14} className={cn("text-[#E3D6BF]/30 shrink-0 mt-0.5 transition-transform duration-200", isExpanded && "rotate-180")} />
              </div>
              {isExpanded && q.notes && (
                <div className="px-4 pb-4 pt-0">
                  <div className="bg-[#1E1118]/40 rounded-lg p-3 border-l-2 border-[#933B5B]/40">
                    <p className="text-xs text-[#E3D6BF]/60 leading-relaxed" style={{ fontFamily: "var(--font-dm-sans)" }}>{q.notes}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Cover Letter Tab ──────────────────────────────────────────────────────────

function CoverLetterTab() {
  const [form, setForm] = useState({ role: "", company: "", jobDesc: "", background: "" });
  const [letter, setLetter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.role || !form.company) return;
    setLoading(true);
    setLetter(null);
    setError(null);
    try {
      const res = await fetch("/api/ai/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLetter(data.letter);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!letter) return;
    await navigator.clipboard.writeText(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div>
        <p className="text-sm font-medium text-[#E3D6BF]/70 mb-4" style={{ fontFamily: "var(--font-dm-sans)" }}>Generate a tailored cover letter</p>
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Role *</label>
              <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} required placeholder="Software Engineer Intern" className="w-full bg-[#150D11] rounded-xl px-3 py-2.5 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none" style={{ fontFamily: "var(--font-dm-sans)" }} />
            </div>
            <div>
              <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Company *</label>
              <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} required placeholder="Google" className="w-full bg-[#150D11] rounded-xl px-3 py-2.5 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none" style={{ fontFamily: "var(--font-dm-sans)" }} />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Key job requirements</label>
            <textarea value={form.jobDesc} onChange={e => setForm(f => ({ ...f, jobDesc: e.target.value }))} rows={3} placeholder="e.g. Strong DSA, Python/Java, system design, 3+ months project experience..." className="w-full bg-[#150D11] rounded-xl px-3 py-2.5 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none resize-none" style={{ fontFamily: "var(--font-dm-sans)" }} />
          </div>
          <div>
            <label className="text-xs text-[#AABAAE] mb-1 block" style={{ fontFamily: "var(--font-dm-sans)" }}>Your background</label>
            <textarea value={form.background} onChange={e => setForm(f => ({ ...f, background: e.target.value }))} rows={4} placeholder="e.g. 3rd year CSE, built RAG system using LangChain + FAISS, open source contributions to X, strong in Python and DSA..." className="w-full bg-[#150D11] rounded-xl px-3 py-2.5 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none resize-none" style={{ fontFamily: "var(--font-dm-sans)" }} />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-xs text-[#933B5B] bg-[#933B5B]/10 border border-[#933B5B]/20 rounded-xl px-3 py-2">
              <AlertCircle size={12} /> {error}
            </div>
          )}
          <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl bg-[#933B5B]/20 text-[#933B5B] hover:bg-[#933B5B]/30 disabled:opacity-50 transition-all border border-[#933B5B]/20 text-sm font-medium flex items-center justify-center gap-2" style={{ fontFamily: "var(--font-dm-sans)" }}>
            {loading ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <><Sparkles size={14} /> Generate Cover Letter</>}
          </button>
        </form>
      </div>

      {/* Output */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-[#E3D6BF]/70" style={{ fontFamily: "var(--font-dm-sans)" }}>Preview</p>
          {letter && (
            <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-[#AABAAE] hover:text-[#AABAAE]/80 transition-colors" style={{ fontFamily: "var(--font-dm-sans)" }}>
              {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
            </button>
          )}
        </div>
        <div className="bg-[#150D11] rounded-2xl border border-[#E3D6BF]/8 p-5 min-h-[360px]">
          {loading && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 size={20} className="animate-spin text-[#933B5B]" />
              <p className="text-xs text-[#E3D6BF]/40" style={{ fontFamily: "var(--font-dm-sans)" }}>Writing your cover letter...</p>
            </div>
          )}
          {!loading && !letter && (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-center">
              <MessageSquare size={24} className="text-[#E3D6BF]/20" />
              <p className="text-sm text-[#E3D6BF]/30" style={{ fontFamily: "var(--font-dm-sans)" }}>Your cover letter will appear here.</p>
              <p className="text-xs text-[#E3D6BF]/20" style={{ fontFamily: "var(--font-dm-sans)" }}>Fill in the form on the left and click Generate.</p>
            </div>
          )}
          {letter && (
            <p className="text-sm text-[#E3D6BF]/80 leading-relaxed whitespace-pre-wrap" style={{ fontFamily: "var(--font-dm-sans)" }}>{letter}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { id: CareerTab; label: string; icon: React.ElementType }[] = [
  { id: "applications", label: "Applications", icon: Briefcase },
  { id: "resume",       label: "Resume",       icon: FileText  },
  { id: "interview",    label: "Interview Prep", icon: Users   },
  { id: "coverletter",  label: "Cover Letter",  icon: MessageSquare },
];

export default function CareerPage() {
  const [tab, setTab] = useState<CareerTab>("applications");
  const [apps, setApps] = useState<Application[]>(INITIAL_APPS);
  const [questions, setQuestions] = useState<InterviewQuestion[]>(INITIAL_QUESTIONS);

  const stats = useMemo(() => ({
    total: apps.length,
    active: apps.filter((a) => !["rejected", "withdrawn"].includes(a.status)).length,
    offer: apps.filter((a) => a.status === "offer").length,
    rejected: apps.filter((a) => a.status === "rejected").length,
  }), [apps]);

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div>
        <p className="text-xs font-medium tracking-[0.1em] uppercase text-[#AABAAE]/70 mb-1" style={{ fontFamily: "var(--font-dm-sans)" }}>Module 7</p>
        <h1 className="text-4xl font-light text-[#E3D6BF]" style={{ fontFamily: "var(--font-cormorant)" }}>Career OS</h1>
        <p className="text-sm text-[#E3D6BF]/50 mt-1" style={{ fontFamily: "var(--font-dm-sans)" }}>Track applications, prep for interviews, and generate cover letters.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Applied", value: stats.total, sub: "total applications" },
          { label: "Active", value: stats.active, sub: "in pipeline" },
          { label: "Offers", value: stats.offer, sub: "received" },
          { label: "Rejected", value: stats.rejected, sub: "this cycle" },
        ].map((s) => (
          <div key={s.label} className="bg-[#150D11] rounded-xl p-4 border border-[#E3D6BF]/8">
            <p className="text-3xl font-light text-[#E3D6BF]" style={{ fontFamily: "var(--font-cormorant)" }}>{s.value}</p>
            <p className="text-xs text-[#E3D6BF]/50 mt-0.5" style={{ fontFamily: "var(--font-dm-sans)" }}>{s.sub}</p>
            <p className="text-xs text-[#AABAAE]/60 mt-0.5" style={{ fontFamily: "var(--font-dm-sans)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#150D11]/40 rounded-xl p-1 w-fit border border-[#E3D6BF]/8 flex-wrap">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-all", tab === t.id ? "bg-[#1E1118] text-[#E3D6BF] shadow-sm" : "text-[#E3D6BF]/40 hover:text-[#E3D6BF]/70")}
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              <Icon size={13} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "applications" && (
        <ApplicationsTab
          apps={apps}
          onAdd={(app) => setApps((p) => [app, ...p])}
          onDelete={(id) => setApps((p) => p.filter((a) => a.id !== id))}
          onStatusChange={(id, status) =>
            setApps((p) => p.map((a) => (a.id === id ? { ...a, status } : a)))
          }
        />
      )}
      {tab === "resume" && <ResumeTab versions={INITIAL_RESUMES} />}
      {tab === "interview" && (
        <InterviewTab
          questions={questions}
          onToggle={(id) =>
            setQuestions((p) =>
              p.map((q) => (q.id === id ? { ...q, practiced: !q.practiced } : q))
            )
          }
        />
      )}
      {tab === "coverletter" && <CoverLetterTab />}
    </div>
  );
}
