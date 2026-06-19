"use client";

import { CalendarDays, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

type Event = {
  id: string;
  time: string;
  title: string;
  duration: string;
  type: "study" | "free" | "meeting" | "project";
};

const todayEvents: Event[] = [
  { id: "1", time: "09:00", title: "Algorithms Lecture",        duration: "1h 30m", type: "study"   },
  { id: "2", time: "11:30", title: "Graph ML Paper — §3",       duration: "45m",    type: "study"   },
  { id: "3", time: "13:00", title: "Lunch Break",               duration: "1h",     type: "free"    },
  { id: "4", time: "14:00", title: "Interview Prep (Stripe)",   duration: "1h",     type: "meeting" },
  { id: "5", time: "16:00", title: "Free Block — 2h available", duration: "2h",     type: "free"    },
  { id: "6", time: "19:00", title: "French Study Session",      duration: "30m",    type: "study"   },
];

const typeStyles: Record<Event["type"], { bg: string; dot: string }> = {
  study:   { bg: "rgba(170, 186, 174, 0.12)",  dot: "#AABAAE" },
  free:    { bg: "rgba(227, 214, 191, 0.06)",  dot: "#E3D6BF" },
  meeting: { bg: "rgba(121, 86,  99,  0.12)",  dot: "#933B5B" },
  project: { bg: "rgba(1,   22,  39,  0.3)",   dot: "#150D11" },
};

export function CalendarPreview() {
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
          <CalendarDays size={16} className="text-[#AABAAE]" />
          <h2
            className="text-base font-semibold text-[#E3D6BF]"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Today
          </h2>
        </div>
        <Link
          href="/calendar"
          className="text-xs text-[#E3D6BF]/40 hover:text-[#AABAAE] transition-colors flex items-center gap-1"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          Full view <ArrowRight size={11} />
        </Link>
      </div>

      <div className="space-y-1.5">
        {todayEvents.map((event) => {
          const style = typeStyles[event.type];
          const isFree = event.type === "free";
          return (
            <div
              key={event.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:brightness-110"
              style={{ background: style.bg }}
            >
              <div className="flex flex-col items-end shrink-0 w-11">
                <span
                  className="text-[11px] font-medium text-[#E3D6BF]/70"
                  style={{ fontFamily: "var(--font-jetbrains)" }}
                >
                  {event.time}
                </span>
              </div>
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: style.dot }}
              />
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm truncate ${isFree ? "text-[#E3D6BF]/50 italic" : "text-[#E3D6BF]/85"}`}
                  style={{ fontFamily: "var(--font-dm-sans)" }}
                >
                  {event.title}
                </p>
              </div>
              <div className="flex items-center gap-1 text-[#E3D6BF]/35 shrink-0">
                <Clock size={10} />
                <span
                  className="text-[10px]"
                  style={{ fontFamily: "var(--font-dm-sans)" }}
                >
                  {event.duration}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
