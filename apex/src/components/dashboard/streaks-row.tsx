"use client";

import { Flame, Zap } from "lucide-react";

type Streak = {
  label: string;
  emoji: string;
  current: number;
  longest: number;
  color: string;
};

const streaks: Streak[] = [
  { label: "DSA",      emoji: "🔢", current: 7,  longest: 14, color: "#150D11" },
  { label: "French",   emoji: "🇫🇷", current: 12, longest: 21, color: "#AABAAE" },
  { label: "Arabic",   emoji: "🇸🇦", current: 4,  longest: 9,  color: "#933B5B" },
  { label: "Mandarin", emoji: "🇨🇳", current: 2,  longest: 6,  color: "#AABAAE" },
  { label: "Research", emoji: "📄", current: 3,  longest: 10, color: "#150D11" },
  { label: "Skills",   emoji: "🎓", current: 5,  longest: 11, color: "#933B5B" },
];

function StreakBar({ current, longest, color }: { current: number; longest: number; color: string }) {
  const pct = Math.min((current / longest) * 100, 100);
  return (
    <div className="h-1 rounded-full bg-white/8 overflow-hidden mt-1.5">
      <div
        className="h-full rounded-full transition-all duration-1000"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

export function StreaksRow() {
  return (
    <div
      className="rounded-2xl p-5 fade-in"
      style={{
        background: "rgba(21, 13, 17, 0.6)",
        border: "1px solid rgba(170, 186, 174, 0.18)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Flame size={16} className="text-[#933B5B]" />
        <h2
          className="text-base font-semibold text-[#E3D6BF]"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          Streaks
        </h2>
      </div>

      <div className="space-y-3">
        {streaks.map((s) => (
          <div key={s.label}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">{s.emoji}</span>
                <span
                  className="text-sm text-[#E3D6BF]/80"
                  style={{ fontFamily: "var(--font-dm-sans)" }}
                >
                  {s.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap size={12} style={{ color: s.color }} />
                <span
                  className="text-sm font-semibold text-[#E3D6BF]"
                  style={{ fontFamily: "var(--font-dm-sans)" }}
                >
                  {s.current}d
                </span>
                <span
                  className="text-xs text-[#E3D6BF]/35"
                  style={{ fontFamily: "var(--font-dm-sans)" }}
                >
                  / {s.longest}
                </span>
              </div>
            </div>
            <StreakBar current={s.current} longest={s.longest} color={s.color} />
          </div>
        ))}
      </div>
    </div>
  );
}
