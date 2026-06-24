"use client";

import { CheckCircle2, Circle, Clock, Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  title: string;
  module: string;
  moduleColor: string;
  duration: string;
  done: boolean;
};

const initialTasks: Task[] = [
  { id: "1", title: "Read §3 of Graph Neural Networks paper", module: "Research", moduleColor: "#933B5B", duration: "45 min", done: false },
  { id: "2", title: "French vocabulary review (14 items due)", module: "French", moduleColor: "#AABAAE", duration: "20 min", done: false },
  { id: "3", title: "#417 Pacific Atlantic Water Flow", module: "DSA", moduleColor: "#150D11", duration: "30 min", done: true },
  { id: "4", title: "Update Fuel Delivery API auth routes", module: "Project", moduleColor: "#AABAAE", duration: "1 hr", done: false },
  { id: "5", title: "Review Azure AZ-900 Module 2", module: "Skills", moduleColor: "#933B5B", duration: "35 min", done: false },
];

export function FocusList() {
  const [tasks, setTasks] = useState(initialTasks);

  const toggle = (id: string) =>
    setTasks((t) => t.map((task) => task.id === id ? { ...task, done: !task.done } : task));

  const done = tasks.filter((t) => t.done).length;

  return (
    <div
      className="rounded-2xl p-5 h-full fade-in"
      style={{
        background: "rgba(21, 13, 17, 0.6)",
        border: "1px solid rgba(170, 186, 174, 0.18)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2
            className="text-base font-semibold text-[#E3D6BF]"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Today&apos;s Focus
          </h2>
          <p
            className="text-xs text-[#E3D6BF]/50 mt-0.5"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            {done}/{tasks.length} completed
          </p>
        </div>
        <button className="p-1.5 rounded-lg text-[#E3D6BF]/40 hover:text-[#AABAAE] hover:bg-[#AABAAE]/10 transition-all">
          <Plus size={16} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-white/5 mb-4 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#AABAAE] transition-all duration-700"
          style={{ width: `${(done / tasks.length) * 100}%` }}
        />
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => toggle(task.id)}
            className="w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all hover:bg-white/5 group"
          >
            {task.done ? (
              <CheckCircle2 size={18} className="text-[#AABAAE] shrink-0 mt-0.5" />
            ) : (
              <Circle size={18} className="text-[#E3D6BF]/25 shrink-0 mt-0.5 group-hover:text-[#E3D6BF]/50 transition-colors" />
            )}
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "text-sm leading-snug",
                  task.done
                    ? "line-through text-[#E3D6BF]/35"
                    : "text-[#E3D6BF]/85"
                )}
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                {task.title}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                  style={{
                    background: `${task.moduleColor}18`,
                    color: task.moduleColor,
                    fontFamily: "var(--font-dm-sans)",
                  }}
                >
                  {task.module}
                </span>
                <span
                  className="text-[10px] text-[#E3D6BF]/35 flex items-center gap-1"
                  style={{ fontFamily: "var(--font-dm-sans)" }}
                >
                  <Clock size={9} />
                  {task.duration}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
