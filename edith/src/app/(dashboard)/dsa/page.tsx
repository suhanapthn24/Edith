"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Code2, ExternalLink, Filter, Check, Minus, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = "http://localhost:8000/api/v1/dsa";

// ── Types ────────────────────────────────────────────────────────────────────

type Status = "unsolved" | "attempted" | "solved" | "needs_revision";

type Category = {
  id: string;
  name: string;
  order_index: number | null;
  total_problems: number | null;
};

type Problem = {
  id: string;
  title: string;
  difficulty: string | null;
  neetcode_category_id: string | null;
  status: Status;
  leetcode_id: number | null;
  leetcode_slug: string | null;
  neetcode_order: number | null;
};

// ── Styles ────────────────────────────────────────────────────────────────────

const difficultyStyle: Record<string, string> = {
  Easy:   "text-[#AABAAE] bg-[#AABAAE]/10",
  Medium: "text-[#E3D6BF]/80 bg-[#E3D6BF]/8",
  Hard:   "text-[#933B5B] bg-[#933B5B]/10",
};

// ── Checkbox ──────────────────────────────────────────────────────────────────

function Checkbox({ checked, indeterminate, onClick }: {
  checked: boolean;
  indeterminate: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-[18px] h-[18px] rounded-[4px] border flex items-center justify-center shrink-0 transition-all duration-150",
        checked
          ? "bg-[#AABAAE] border-[#AABAAE]"
          : indeterminate
          ? "bg-[#933B5B]/20 border-[#933B5B]/60"
          : "border-[#E3D6BF]/20 hover:border-[#AABAAE]/50 bg-transparent"
      )}
      aria-label="Toggle solved"
    >
      {checked && <Check size={11} strokeWidth={3} className="text-[#150D11]" />}
      {!checked && indeterminate && <Minus size={11} strokeWidth={3} className="text-[#933B5B]" />}
    </button>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded bg-[#AABAAE]/8", className)} />
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 18 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(21,13,17,0.6)", border: "1px solid rgba(170,186,174,0.18)" }}>
        <Skeleton className="h-12 w-full" />
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full mt-px" />
        ))}
      </div>
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <div className="p-4 rounded-2xl bg-[#933B5B]/10">
        <AlertCircle size={28} className="text-[#933B5B]" />
      </div>
      <div className="text-center">
        <p className="text-[#E3D6BF] mb-1" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.25rem" }}>
          Could not load problems
        </p>
        <p className="text-sm text-[#E3D6BF]/40" style={{ fontFamily: "var(--font-dm-sans)" }}>{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-[#E3D6BF] transition-all hover:brightness-110"
        style={{ background: "rgba(170,186,174,0.12)", border: "1px solid rgba(170,186,174,0.25)" }}
      >
        <RefreshCw size={13} /> Retry
      </button>
      <p className="text-xs text-[#E3D6BF]/25" style={{ fontFamily: "var(--font-dm-sans)" }}>
        Make sure the backend is running: <code className="text-[#AABAAE]/70">uvicorn main:app --reload</code>
      </p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DSAPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catsRes, probleRes] = await Promise.all([
        fetch(`${API_BASE}/categories`),
        fetch(`${API_BASE}/problems?neetcode_only=true`),
      ]);
      if (!catsRes.ok || !probleRes.ok) throw new Error("Server returned an error");
      const [cats, probs] = await Promise.all([catsRes.json(), probleRes.json()]);
      setCategories(cats);
      setProblems(probs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, [fetchData]);

  const toggle = useCallback(async (problem: Problem) => {
    const nextStatus: Status = problem.status === "solved" ? "unsolved" : "solved";

    // Optimistic update
    setProblems(prev => prev.map(p => p.id === problem.id ? { ...p, status: nextStatus } : p));
    setToggling(prev => new Set(prev).add(problem.id));

    try {
      const res = await fetch(`${API_BASE}/problems/${problem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const updated: Problem = await res.json();
      setProblems(prev => prev.map(p => p.id === problem.id ? updated : p));
    } catch {
      // Revert on failure
      setProblems(prev => prev.map(p => p.id === problem.id ? { ...p, status: problem.status } : p));
    } finally {
      setToggling(prev => { const s = new Set(prev); s.delete(problem.id); return s; });
    }
  }, []);

  // Build category name → id map
  const categoryById = useMemo(() => {
    const m: Record<string, Category> = {};
    for (const c of categories) m[c.id] = c;
    return m;
  }, [categories]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of problems) {
      if (p.status === "solved" && p.neetcode_category_id) {
        counts[p.neetcode_category_id] = (counts[p.neetcode_category_id] ?? 0) + 1;
      }
    }
    return counts;
  }, [problems]);

  const totalSolved = useMemo(() => problems.filter(p => p.status === "solved").length, [problems]);

  const visibleProblems = useMemo(() => problems.filter(p => {
    if (selectedCategory && p.neetcode_category_id !== selectedCategory) return false;
    if (filterStatus === "solved") return p.status === "solved";
    if (filterStatus === "attempted") return p.status === "attempted";
    if (filterStatus === "unsolved") return p.status === "unsolved" || p.status === "needs_revision";
    return true;
  }), [problems, selectedCategory, filterStatus]);

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  const orderedCategories = [...categories].sort((a, b) => (a.order_index ?? 99) - (b.order_index ?? 99));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="fade-in flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Code2 size={20} className="text-[#AABAAE]" />
            <h1 className="text-4xl font-light text-[#E3D6BF]" style={{ fontFamily: "var(--font-cormorant)" }}>
              NeetCode 150
            </h1>
          </div>
          <p className="text-sm text-[#E3D6BF]/50" style={{ fontFamily: "var(--font-dm-sans)" }}>
            {totalSolved} / {problems.length} solved · Follow the roadmap, one category at a time
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 rounded-lg text-[#E3D6BF]/30 hover:text-[#AABAAE] hover:bg-[#AABAAE]/8 transition-all"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Category grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {orderedCategories.map((cat, i) => {
          const total  = cat.total_problems ?? 0;
          const solved = categoryCounts[cat.id] ?? 0;
          const pct    = total > 0 ? (solved / total) * 100 : 0;
          const done   = total > 0 && solved === total;
          const active = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(active ? null : cat.id)}
              className={cn(
                "rounded-xl p-3 text-left transition-all border",
                active
                  ? "border-[#AABAAE]/60 bg-[#AABAAE]/10"
                  : "border-transparent hover:border-[#AABAAE]/20"
              )}
              style={{ background: active ? undefined : "rgba(21,13,17,0.5)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={cn("text-[10px] font-semibold", done ? "text-[#AABAAE]" : "text-[#E3D6BF]/50")}
                  style={{ fontFamily: "var(--font-dm-sans)" }}
                >
                  {solved}/{total}
                </span>
                <span className="text-[10px] text-[#E3D6BF]/30" style={{ fontFamily: "var(--font-dm-sans)" }}>
                  #{i + 1}
                </span>
              </div>
              <p className="text-[11px] font-medium text-[#E3D6BF]/80 leading-snug mb-2" style={{ fontFamily: "var(--font-dm-sans)" }}>
                {cat.name}
              </p>
              <div className="h-1 rounded-full bg-white/8 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: done ? "linear-gradient(90deg, #AABAAE, #933B5B)" : "#AABAAE",
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Problem list */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "rgba(21,13,17,0.6)", border: "1px solid rgba(170,186,174,0.18)" }}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#AABAAE]/10">
          <p className="text-sm text-[#E3D6BF]/60" style={{ fontFamily: "var(--font-dm-sans)" }}>
            {selectedCategory ? categoryById[selectedCategory]?.name : "All problems"} · {visibleProblems.length} shown
          </p>
          <div className="flex items-center gap-1">
            <Filter size={12} className="text-[#E3D6BF]/25 mr-1" />
            {(["all", "unsolved", "attempted", "solved"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={cn(
                  "text-[11px] px-2.5 py-1 rounded-lg capitalize transition-all",
                  filterStatus === f
                    ? "bg-[#AABAAE]/15 text-[#AABAAE]"
                    : "text-[#E3D6BF]/40 hover:text-[#E3D6BF]/70"
                )}
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/4">
          {visibleProblems.map((p) => {
            const solved    = p.status === "solved";
            const attempted = p.status === "attempted";
            const busy      = toggling.has(p.id);
            const catName   = p.neetcode_category_id ? categoryById[p.neetcode_category_id]?.name : null;

            return (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-4 px-5 py-3 transition-all group",
                  solved ? "hover:bg-[#AABAAE]/5" : "hover:bg-white/3"
                )}
              >
                {busy ? (
                  <Loader2 size={14} className="text-[#AABAAE]/50 animate-spin shrink-0" />
                ) : (
                  <Checkbox checked={solved} indeterminate={attempted} onClick={() => toggle(p)} />
                )}

                <span
                  className="text-xs text-[#E3D6BF]/25 w-8 shrink-0 tabular-nums"
                  style={{ fontFamily: "var(--font-jetbrains)" }}
                >
                  {p.neetcode_order ?? "—"}
                </span>

                <p
                  className={cn(
                    "flex-1 text-sm transition-colors",
                    solved
                      ? "line-through text-[#E3D6BF]/35"
                      : "text-[#E3D6BF]/85 group-hover:text-[#E3D6BF]"
                  )}
                  style={{ fontFamily: "var(--font-dm-sans)" }}
                >
                  {p.title}
                </p>

                {p.difficulty && (
                  <span
                    className={cn("text-[11px] font-medium px-2 py-0.5 rounded shrink-0", difficultyStyle[p.difficulty] ?? "text-[#E3D6BF]/40")}
                    style={{ fontFamily: "var(--font-dm-sans)" }}
                  >
                    {p.difficulty}
                  </span>
                )}

                {catName && (
                  <span
                    className="text-[11px] text-[#E3D6BF]/30 hidden lg:block shrink-0 w-40 truncate"
                    style={{ fontFamily: "var(--font-dm-sans)" }}
                  >
                    {catName}
                  </span>
                )}

                {p.leetcode_slug && (
                  <a
                    href={`https://leetcode.com/problems/${p.leetcode_slug}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-[#E3D6BF]/20 hover:text-[#AABAAE] hover:bg-[#AABAAE]/10 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            );
          })}

          {visibleProblems.length === 0 && (
            <div className="px-5 py-12 text-center text-[#E3D6BF]/30 text-sm" style={{ fontFamily: "var(--font-dm-sans)" }}>
              No problems match this filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
