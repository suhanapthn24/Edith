"use client";

import { Sparkles, RefreshCw } from "lucide-react";

const mockBriefing = {
  headline: "Focus on depth today — your Graph ML paper and French session are your highest-leverage activities.",
  priorities: [
    "Complete §3 of 'Graph Neural Networks: A Review' — methodology section",
    "French vocab review: 14 items due (SM-2 schedule)",
    "LeetCode #417 Pacific Atlantic Water Flow — Graphs category (NeetCode 150)",
  ],
  insight: "You've been strong on DSA this week (7-day streak) but Research has slipped 3 days. A 45-min paper session today keeps the momentum.",
};

export function BriefingCard() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6 fade-in"
      style={{
        background: "linear-gradient(135deg, rgba(21, 13, 17, 0.6) 0%, rgba(30, 17, 24, 0.75) 100%)",
        border: "1px solid rgba(170, 186, 174, 0.25)",
      }}
    >
      {/* Background orb */}
      <div
        className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-10 pointer-events-none"
        style={{
          background: "radial-gradient(circle, #933B5B 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#AABAAE]/20">
              <Sparkles size={16} className="text-[#AABAAE]" />
            </div>
            <span
              className="text-xs font-semibold tracking-[0.12em] uppercase text-[#AABAAE]"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              AI Briefing
            </span>
          </div>
          <button className="p-1.5 rounded-lg text-[#E3D6BF]/40 hover:text-[#E3D6BF]/70 hover:bg-white/5 transition-all">
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Main text */}
        <p
          className="text-xl font-medium text-[#E3D6BF] leading-relaxed mb-5"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          {mockBriefing.headline}
        </p>

        {/* Priorities */}
        <div className="space-y-2 mb-4">
          {mockBriefing.priorities.map((p, i) => (
            <div key={i} className="flex items-start gap-3">
              <span
                className="text-xs font-bold text-[#933B5B] mt-0.5 shrink-0 w-5 h-5 rounded-full border border-[#933B5B]/40 flex items-center justify-center"
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                {i + 1}
              </span>
              <span
                className="text-sm text-[#E3D6BF]/80 leading-relaxed"
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                {p}
              </span>
            </div>
          ))}
        </div>

        {/* Insight */}
        <div
          className="rounded-xl px-4 py-3 text-sm text-[#E3D6BF]/70 italic leading-relaxed"
          style={{
            background: "rgba(170, 186, 174, 0.08)",
            borderLeft: "2px solid rgba(170, 186, 174, 0.4)",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          {mockBriefing.insight}
        </div>
      </div>
    </div>
  );
}
