"use client";

import { useState, useMemo } from "react";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, X,
  Sparkles, Send, Loader2, Clock, BookOpen,
  Brain, Flame, Target, AlertCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type EventType = "study" | "review" | "reading" | "practice" | "break" | "deadline";

interface CalEvent {
  id: string;
  title: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
  type: EventType;
  description?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<EventType, { bg: string; text: string; dot: string }> = {
  study:    { bg: "rgba(170,186,174,0.25)", text: "#E3D6BF",  dot: "#AABAAE" },
  review:   { bg: "rgba(147,59,91,0.25)",  text: "#E3D6BF",  dot: "#933B5B" },
  reading:  { bg: "rgba(21,13,17,0.6)",     text: "#E3D6BF",  dot: "#E3D6BF" },
  practice: { bg: "rgba(30,17,24,0.6)",    text: "#AABAAE",  dot: "#AABAAE" },
  break:    { bg: "rgba(170,186,174,0.1)", text: "#AABAAE",  dot: "#AABAAE" },
  deadline: { bg: "rgba(180,50,50,0.2)",   text: "#F87171",  dot: "#F87171" },
};

const TYPE_ICONS: Record<EventType, React.ReactNode> = {
  study:    <BookOpen size={10} />,
  review:   <Brain size={10} />,
  reading:  <BookOpen size={10} />,
  practice: <Target size={10} />,
  break:    <Clock size={10} />,
  deadline: <Flame size={10} />,
};

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7am–10pm
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Seed events ───────────────────────────────────────────────────────────────

function seedEvents(weekDates: string[]): CalEvent[] {
  const [mon, tue, , thu, fri] = weekDates;
  return [
    { id: "1", title: "French vocab review",   date: mon, startTime: "08:00", endTime: "08:20", type: "review",   description: "SM-2 due cards" },
    { id: "2", title: "DSA practice",          date: tue, startTime: "09:00", endTime: "09:45", type: "practice", description: "NeetCode 150 session" },
    { id: "3", title: "Arabic review",          date: mon, startTime: "20:00", endTime: "20:15", type: "review" },
    { id: "4", title: "Read research paper",    date: thu, startTime: "14:00", endTime: "15:00", type: "reading",  description: "Attention paper" },
    { id: "5", title: "French listening",       date: fri, startTime: "08:30", endTime: "09:00", type: "study" },
  ];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeekDates(refDate: Date): string[] {
  const d = new Date(refDate);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return dt.toISOString().split("T")[0];
  });
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatHour(h: number): string {
  if (h === 12) return "12pm";
  if (h > 12) return `${h - 12}pm`;
  return `${h}am`;
}

// ── Add Event Modal ───────────────────────────────────────────────────────────

function AddEventModal({ weekDates, defaultDate, onAdd, onClose }: {
  weekDates: string[];
  defaultDate?: string;
  onAdd: (e: CalEvent) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<CalEvent, "id">>({
    title: "", date: defaultDate ?? weekDates[0], startTime: "09:00", endTime: "09:30", type: "study", description: "",
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onAdd({ ...form, id: Date.now().toString() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#150D11]/75 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl p-6"
        style={{ background: "rgba(21,13,17,0.97)", border: "1px solid rgba(170,186,174,0.2)" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-light text-[#E3D6BF]" style={{ fontFamily: "var(--font-cormorant)" }}>Add event</h2>
          <button onClick={onClose} className="text-[#E3D6BF]/40 hover:text-[#E3D6BF]"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-[#AABAAE] mb-1 block">Title *</label>
            <input value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="e.g. French vocabulary review"
              className="w-full rounded-lg px-3 py-2 text-sm text-[#E3D6BF] placeholder:text-[#E3D6BF]/20 outline-none"
              style={{ background: "rgba(30,17,24,0.5)", border: "1px solid rgba(170,186,174,0.15)" }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#AABAAE] mb-1 block">Date</label>
              <select value={form.date} onChange={e => set("date", e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm text-[#E3D6BF] outline-none"
                style={{ background: "rgba(30,17,24,0.5)", border: "1px solid rgba(170,186,174,0.15)" }}>
                {weekDates.map((d, i) => (
                  <option key={d} value={d} style={{ background: "#150D11" }}>
                    {DAYS[i]} {formatDate(d)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#AABAAE] mb-1 block">Type</label>
              <select value={form.type} onChange={e => set("type", e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm text-[#E3D6BF] outline-none capitalize"
                style={{ background: "rgba(30,17,24,0.5)", border: "1px solid rgba(170,186,174,0.15)" }}>
                {(Object.keys(TYPE_STYLES) as EventType[]).map(t => (
                  <option key={t} value={t} style={{ background: "#150D11" }} className="capitalize">{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {["startTime", "endTime"].map(k => (
              <div key={k}>
                <label className="text-xs text-[#AABAAE] mb-1 block capitalize">{k === "startTime" ? "Start" : "End"}</label>
                <input type="time" value={form[k as keyof typeof form] as string}
                  onChange={e => set(k, e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm text-[#E3D6BF] outline-none"
                  style={{ background: "rgba(30,17,24,0.5)", border: "1px solid rgba(170,186,174,0.15)" }} />
              </div>
            ))}
          </div>

          <div>
            <label className="text-xs text-[#AABAAE] mb-1 block">Notes (optional)</label>
            <input value={form.description ?? ""} onChange={e => set("description", e.target.value)}
              placeholder="What will you work on?"
              className="w-full rounded-lg px-3 py-2 text-sm text-[#E3D6BF] placeholder:text-[#E3D6BF]/20 outline-none"
              style={{ background: "rgba(30,17,24,0.5)", border: "1px solid rgba(170,186,174,0.15)" }} />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm text-[#E3D6BF]/50"
              style={{ border: "1px solid rgba(170,186,174,0.1)" }}>
              Cancel
            </button>
            <button type="submit" disabled={!form.title.trim()}
              className="flex-1 py-2.5 rounded-lg text-sm text-[#E3D6BF] font-medium hover:brightness-110 disabled:opacity-40"
              style={{ background: "rgba(147,59,91,0.3)", border: "1px solid rgba(147,59,91,0.4)" }}>
              Add event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Week Grid ─────────────────────────────────────────────────────────────────

function WeekGrid({ weekDates, events, today, onSlotClick }: {
  weekDates: string[];
  events: CalEvent[];
  today: string;
  onSlotClick: (date: string) => void;
}) {
  const SLOT_HEIGHT = 48; // px per hour
  const START_HOUR = 7;

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    weekDates.forEach(d => { map[d] = []; });
    events.forEach(e => {
      if (map[e.date]) map[e.date].push(e);
    });
    return map;
  }, [events, weekDates]);

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(21,13,17,0.5)", border: "1px solid rgba(170,186,174,0.12)" }}>
      {/* Day header */}
      <div className="grid border-b border-[#AABAAE]/10" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
        <div className="py-3" />
        {weekDates.map((d, i) => {
          const isToday = d === today;
          return (
            <div key={d} className="py-3 text-center border-l border-[#AABAAE]/8 first:border-l-0">
              <p className="text-[10px] text-[#E3D6BF]/40 uppercase tracking-widest">{DAYS[i]}</p>
              <div className={`mx-auto mt-0.5 w-7 h-7 rounded-full flex items-center justify-center`}
                style={isToday ? { background: "rgba(147,59,91,0.4)" } : {}}>
                <p className="text-sm" style={{ color: isToday ? "#E3D6BF" : "#E3D6BF" }}>
                  {formatDate(d).split(" ")[1]}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 340px)" }}>
        <div className="relative" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
          {/* Hour rows */}
          {HOURS.map(h => (
            <div key={h} className="flex border-b border-[#AABAAE]/5" style={{ height: SLOT_HEIGHT }}>
              <div className="w-12 shrink-0 flex items-start justify-end pr-2 pt-1">
                <span className="text-[10px] text-[#E3D6BF]/20">{formatHour(h)}</span>
              </div>
              {weekDates.map(d => (
                <button key={d}
                  onClick={() => onSlotClick(d)}
                  className="flex-1 border-l border-[#AABAAE]/5 hover:bg-[#AABAAE]/5 transition-colors"
                  style={{ height: SLOT_HEIGHT }} />
              ))}
            </div>
          ))}

          {/* Events */}
          <div className="absolute inset-0 pointer-events-none" style={{ left: 48 }}>
            {weekDates.map((d, colIdx) => (
              <div key={d} className="absolute top-0 bottom-0"
                style={{ left: `${(colIdx / 7) * 100}%`, width: `${100 / 7}%` }}>
                {eventsByDate[d]?.map(ev => {
                  const startMins = timeToMinutes(ev.startTime) - START_HOUR * 60;
                  const durMins = timeToMinutes(ev.endTime) - timeToMinutes(ev.startTime);
                  const top = (startMins / 60) * SLOT_HEIGHT;
                  const height = Math.max((durMins / 60) * SLOT_HEIGHT, 20);
                  const style = TYPE_STYLES[ev.type];

                  return (
                    <div key={ev.id}
                      className="absolute left-0.5 right-0.5 rounded-lg px-1.5 py-1 overflow-hidden pointer-events-auto cursor-default"
                      style={{ top, height, background: style.bg, border: `1px solid ${style.dot}30` }}>
                      <div className="flex items-center gap-1 mb-0.5">
                        <span style={{ color: style.dot }}>{TYPE_ICONS[ev.type]}</span>
                        <p className="text-[10px] font-medium truncate" style={{ color: style.text }}>
                          {ev.title}
                        </p>
                      </div>
                      {height > 36 && (
                        <p className="text-[9px]" style={{ color: style.text, opacity: 0.6 }}>
                          {ev.startTime}–{ev.endTime}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Month Grid ────────────────────────────────────────────────────────────────

function MonthGrid({ refDate, events, today, onDayClick }: {
  refDate: Date;
  events: CalEvent[];
  today: string;
  onDayClick: (date: string) => void;
}) {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((startPad + lastDay.getDate()) / 7) * 7;

  const cells: (string | null)[] = Array.from({ length: totalCells }, (_, i) => {
    const d = i - startPad + 1;
    if (d < 1 || d > lastDay.getDate()) return null;
    const dt = new Date(year, month, d);
    return dt.toISOString().split("T")[0];
  });

  const eventsByDate = useMemo(() => {
    const m: Record<string, CalEvent[]> = {};
    events.forEach(e => { if (!m[e.date]) m[e.date] = []; m[e.date].push(e); });
    return m;
  }, [events]);

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(21,13,17,0.5)", border: "1px solid rgba(170,186,174,0.12)" }}>
      {/* Day header */}
      <div className="grid grid-cols-7 border-b border-[#AABAAE]/10">
        {DAYS.map(d => (
          <div key={d} className="py-3 text-center">
            <p className="text-[10px] text-[#E3D6BF]/40 uppercase tracking-widest">{d}</p>
          </div>
        ))}
      </div>
      {/* Cells */}
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          const isToday = date === today;
          const dayEvents = date ? (eventsByDate[date] ?? []) : [];
          return (
            <button key={i}
              onClick={() => date && onDayClick(date)}
              className="min-h-[80px] p-2 text-left border-b border-r border-[#AABAAE]/5 hover:bg-[#AABAAE]/5 transition-colors"
              disabled={!date}>
              {date && (
                <>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center mb-1 ${isToday ? "" : ""}`}
                    style={isToday ? { background: "rgba(147,59,91,0.4)" } : {}}>
                    <p className="text-xs" style={{ color: date ? "#E3D6BF" : "transparent", opacity: date ? 1 : 0 }}>
                      {new Date(date + "T00:00:00").getDate()}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(ev => {
                      const style = TYPE_STYLES[ev.type];
                      return (
                        <div key={ev.id} className="text-[9px] px-1 py-0.5 rounded truncate"
                          style={{ background: style.bg, color: style.text }}>
                          {ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <p className="text-[9px] text-[#E3D6BF]/30">+{dayEvents.length - 3} more</p>
                    )}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── AI Schedule Assistant ─────────────────────────────────────────────────────

function AIAssistant({ weekDates, onAddEvents }: {
  weekDates: string[];
  onAddEvents: (events: CalEvent[]) => void;
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastAdded, setLastAdded] = useState(0);

  const send = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input, weekDates }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const events: CalEvent[] = (data.events ?? []).map((e: Omit<CalEvent, "id">, i: number) => ({
        ...e, id: `ai-${Date.now()}-${i}`,
      }));
      onAddEvents(events);
      setLastAdded(events.length);
      setInput("");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "Schedule French review 15 min every morning",
    "Add DSA practice Mon/Wed/Fri 9am-9:45am",
    "Book research reading time on weekends",
  ];

  return (
    <div className="rounded-2xl p-5"
      style={{ background: "rgba(21,13,17,0.5)", border: "1px solid rgba(147,59,91,0.2)", borderLeft: "3px solid #933B5B" }}>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={15} className="text-[#933B5B]" />
        <p className="text-sm text-[#E3D6BF]">AI Schedule Assistant</p>
        <p className="text-xs text-[#E3D6BF]/30 ml-auto">powered by OpenRouter</p>
      </div>

      {lastAdded > 0 && (
        <div className="rounded-xl px-3 py-2 mb-3 text-xs text-[#AABAAE] flex items-center gap-2"
          style={{ background: "rgba(170,186,174,0.1)", border: "1px solid rgba(170,186,174,0.15)" }}>
          <span className="text-[#AABAAE]">✓</span> Added {lastAdded} event{lastAdded !== 1 ? "s" : ""} to your calendar
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Tell me what to schedule…"
          className="flex-1 rounded-xl px-3 py-2.5 text-sm text-[#E3D6BF] placeholder:text-[#E3D6BF]/20 outline-none"
          style={{ background: "rgba(30,17,24,0.5)", border: "1px solid rgba(170,186,174,0.15)" }}
        />
        <button onClick={send} disabled={!input.trim() || loading}
          className="px-4 py-2.5 rounded-xl text-sm text-[#E3D6BF] transition-all hover:brightness-110 disabled:opacity-40 flex items-center gap-2"
          style={{ background: "rgba(147,59,91,0.3)", border: "1px solid rgba(147,59,91,0.4)" }}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 mt-2">
          <AlertCircle size={11} /> {error}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mt-3">
        {suggestions.map(s => (
          <button key={s} onClick={() => setInput(s)}
            className="text-[10px] px-2.5 py-1 rounded-lg text-[#AABAAE] hover:text-[#E3D6BF] transition-colors"
            style={{ background: "rgba(170,186,174,0.08)", border: "1px solid rgba(170,186,174,0.1)" }}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const today = new Date().toISOString().split("T")[0];
  const [refDate, setRefDate] = useState(new Date());
  const [view, setView] = useState<"week" | "month">("week");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEventDate, setNewEventDate] = useState<string | null>(null);

  const weekDates = useMemo(() => getWeekDates(refDate), [refDate]);
  const [events, setEvents] = useState<CalEvent[]>(() => seedEvents(weekDates));

  const addEvent = (e: CalEvent) => setEvents(prev => [...prev, e]);
  const addEvents = (es: CalEvent[]) => setEvents(prev => [...prev, ...es]);

  const prevPeriod = () => {
    const d = new Date(refDate);
    d.setDate(d.getDate() - (view === "week" ? 7 : 30));
    setRefDate(d);
  };

  const nextPeriod = () => {
    const d = new Date(refDate);
    d.setDate(d.getDate() + (view === "week" ? 7 : 30));
    setRefDate(d);
  };

  const goToday = () => setRefDate(new Date());

  const periodLabel = view === "week"
    ? `${formatDate(weekDates[0])} – ${formatDate(weekDates[6])}`
    : refDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Stats for week
  const weekEvents = events.filter(e => weekDates.includes(e.date));
  const studyMins = weekEvents
    .filter(e => ["study", "review", "reading", "practice"].includes(e.type))
    .reduce((s, e) => s + (timeToMinutes(e.endTime) - timeToMinutes(e.startTime)), 0);

  return (
    <div className="space-y-5 fade-in">
      {showAddModal && (
        <AddEventModal
          weekDates={weekDates}
          defaultDate={newEventDate ?? weekDates[0]}
          onAdd={e => { addEvent(e); setShowAddModal(false); setNewEventDate(null); }}
          onClose={() => { setShowAddModal(false); setNewEventDate(null); }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <CalendarDays size={20} className="text-[#AABAAE]" />
            <h1 className="text-4xl font-light text-[#E3D6BF]" style={{ fontFamily: "var(--font-cormorant)" }}>
              Calendar
            </h1>
          </div>
          <p className="text-sm text-[#E3D6BF]/40">
            {weekEvents.length} events this week · {Math.round(studyMins / 60)}h {studyMins % 60}m study time
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Week stats */}
          <div className="hidden md:flex items-center gap-3 mr-2 text-xs text-[#E3D6BF]/30">
            {Object.entries(TYPE_STYLES).filter(([t]) => ["study", "review", "practice"].includes(t)).map(([t, s]) => (
              <span key={t} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: s.dot }} />
                <span className="capitalize">{t}</span>
              </span>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex p-0.5 rounded-lg" style={{ background: "rgba(21,13,17,0.5)", border: "1px solid rgba(170,186,174,0.12)" }}>
            {(["week", "month"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-1.5 rounded-md text-xs capitalize transition-all"
                style={view === v
                  ? { background: "rgba(170,186,174,0.2)", color: "#E3D6BF" }
                  : { color: "#AABAAE" }}>
                {v}
              </button>
            ))}
          </div>

          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-[#E3D6BF] transition-all hover:brightness-110"
            style={{ background: "rgba(147,59,91,0.3)", border: "1px solid rgba(147,59,91,0.4)" }}>
            <Plus size={14} /> Add event
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button onClick={prevPeriod}
          className="p-2 rounded-xl text-[#E3D6BF]/40 hover:text-[#E3D6BF] hover:bg-[#AABAAE]/8 transition-all">
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm text-[#E3D6BF] min-w-[180px] text-center">{periodLabel}</p>
        <button onClick={nextPeriod}
          className="p-2 rounded-xl text-[#E3D6BF]/40 hover:text-[#E3D6BF] hover:bg-[#AABAAE]/8 transition-all">
          <ChevronRight size={16} />
        </button>
        <button onClick={goToday}
          className="px-3 py-1.5 rounded-lg text-xs text-[#AABAAE] hover:text-[#E3D6BF] transition-colors ml-1"
          style={{ border: "1px solid rgba(170,186,174,0.12)" }}>
          Today
        </button>
      </div>

      {/* Calendar grid */}
      {view === "week" ? (
        <WeekGrid
          weekDates={weekDates}
          events={events}
          today={today}
          onSlotClick={date => { setNewEventDate(date); setShowAddModal(true); }}
        />
      ) : (
        <MonthGrid
          refDate={refDate}
          events={events}
          today={today}
          onDayClick={date => { setNewEventDate(date); setShowAddModal(true); }}
        />
      )}

      {/* AI assistant */}
      <AIAssistant weekDates={weekDates} onAddEvents={addEvents} />
    </div>
  );
}
