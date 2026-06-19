"use client";

import { Code2, ArrowRight } from "lucide-react";
import Link from "next/link";

type Category = {
  name: string;
  total: number;
  solved: number;
};

const categories: Category[] = [
  { name: "Arrays & Hashing",       total: 9,  solved: 9  },
  { name: "Two Pointers",           total: 5,  solved: 5  },
  { name: "Sliding Window",         total: 6,  solved: 4  },
  { name: "Stack",                  total: 7,  solved: 3  },
  { name: "Binary Search",          total: 7,  solved: 2  },
  { name: "Linked List",            total: 11, solved: 0  },
  { name: "Trees",                  total: 15, solved: 0  },
  { name: "Graphs",                 total: 13, solved: 0  },
  { name: "1-D DP",                 total: 12, solved: 0  },
];

const totalSolved = categories.reduce((a, c) => a + c.solved, 0);
const totalProblems = 150;

function CategoryBar({ name, total, solved }: Category) {
  const pct = total > 0 ? (solved / total) * 100 : 0;
  const done = solved === total && total > 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-[11px] text-[#E3D6BF]/65 truncate"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          {name}
        </span>
        <span
          className={`text-[11px] font-medium ${done ? "text-[#AABAAE]" : "text-[#E3D6BF]/50"}`}
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          {solved}/{total}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/6 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${pct}%`,
            background: done
              ? "linear-gradient(90deg, #AABAAE, #933B5B)"
              : "#AABAAE",
          }}
        />
      </div>
    </div>
  );
}

export function NeetcodeProgress() {
  const overallPct = Math.round((totalSolved / totalProblems) * 100);

  return (
    <div
      className="rounded-2xl p-5 fade-in"
      style={{
        background: "rgba(21, 13, 17, 0.6)",
        border: "1px solid rgba(170, 186, 174, 0.18)",
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Code2 size={16} className="text-[#AABAAE]" />
          <h2
            className="text-base font-semibold text-[#E3D6BF]"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            NeetCode 150
          </h2>
        </div>
        <Link
          href="/dsa"
          className="text-xs text-[#E3D6BF]/40 hover:text-[#AABAAE] transition-colors flex items-center gap-1"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          All <ArrowRight size={11} />
        </Link>
      </div>

      {/* Big counter */}
      <div className="my-3 text-center">
        <p
          className="text-4xl font-light text-[#E3D6BF]"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          {totalSolved}
          <span className="text-xl text-[#E3D6BF]/35">/{totalProblems}</span>
        </p>
        <p
          className="text-xs text-[#AABAAE] mt-0.5"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          {overallPct}% complete
        </p>
      </div>

      {/* Category bars */}
      <div className="space-y-2.5">
        {categories.slice(0, 7).map((c) => (
          <CategoryBar key={c.name} {...c} />
        ))}
      </div>
    </div>
  );
}
