"use client";

import { Languages, ArrowRight } from "lucide-react";
import Link from "next/link";

type Lang = {
  code: string;
  name: string;
  flag: string;
  level: string;
  nextLevel: string;
  progress: number;
  vocabDue: number;
  streak: number;
};

const languages: Lang[] = [
  { code: "fr", name: "French",   flag: "🇫🇷", level: "A2", nextLevel: "B1", progress: 65, vocabDue: 14, streak: 12 },
  { code: "ar", name: "Arabic",   flag: "🇸🇦", level: "A1", nextLevel: "A2", progress: 30, vocabDue: 8,  streak: 4  },
  { code: "zh", name: "Mandarin", flag: "🇨🇳", level: "A1", nextLevel: "A2", progress: 12, vocabDue: 5,  streak: 2  },
];

const cefrColors: Record<string, string> = {
  A1: "#933B5B",
  A2: "#933B5B",
  B1: "#AABAAE",
  B2: "#AABAAE",
  C1: "#150D11",
  C2: "#150D11",
};

export function LanguageProgress() {
  return (
    <div
      className="rounded-2xl p-5 fade-in"
      style={{
        background: "rgba(21, 13, 17, 0.6)",
        border: "1px solid rgba(170, 186, 174, 0.18)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Languages size={16} className="text-[#AABAAE]" />
          <h2
            className="text-base font-semibold text-[#E3D6BF]"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Languages
          </h2>
        </div>
        <Link
          href="/language"
          className="text-xs text-[#E3D6BF]/40 hover:text-[#AABAAE] transition-colors flex items-center gap-1"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          All <ArrowRight size={11} />
        </Link>
      </div>

      <div className="space-y-4">
        {languages.map((lang) => (
          <div key={lang.code}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-lg">{lang.flag}</span>
                <div>
                  <span
                    className="text-sm font-medium text-[#E3D6BF]"
                    style={{ fontFamily: "var(--font-dm-sans)" }}
                  >
                    {lang.name}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{
                        background: `${cefrColors[lang.level]}18`,
                        color: cefrColors[lang.level],
                        fontFamily: "var(--font-dm-sans)",
                      }}
                    >
                      {lang.level}
                    </span>
                    <span className="text-[10px] text-[#E3D6BF]/30" style={{ fontFamily: "var(--font-dm-sans)" }}>
                      → {lang.nextLevel}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                {lang.vocabDue > 0 && (
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#933B5B]/15 text-[#933B5B]"
                    style={{ fontFamily: "var(--font-dm-sans)" }}
                  >
                    {lang.vocabDue} due
                  </span>
                )}
                <p
                  className="text-[10px] text-[#E3D6BF]/35 mt-0.5"
                  style={{ fontFamily: "var(--font-dm-sans)" }}
                >
                  🔥 {lang.streak}d
                </p>
              </div>
            </div>
            <div className="h-2 rounded-full bg-white/6 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${lang.progress}%`,
                  background: `linear-gradient(90deg, ${cefrColors[lang.level]}, ${cefrColors[lang.nextLevel]})`,
                }}
              />
            </div>
            <p
              className="text-[10px] text-[#E3D6BF]/30 mt-1"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              {lang.progress}% to {lang.nextLevel}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
