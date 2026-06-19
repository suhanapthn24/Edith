"use client";

import { useState } from "react";
import {
  BookOpen, Plus, Search, Star, ExternalLink,
  FileText, X, ChevronDown, StickyNote, Sparkles,
  AlertCircle, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PaperStatus = "to_read" | "reading" | "read" | "archived";

type Paper = {
  id: number;
  title: string;
  authors: string;
  year: number;
  venue: string;
  tags: string[];
  status: PaperStatus;
  rating: number | null;
  abstract: string;
  url: string;
  noteCount: number;
  aiSummary: string | null;
};

const INITIAL_PAPERS: Paper[] = [
  {
    id: 1, title: "Attention Is All You Need", authors: "Vaswani et al.", year: 2017, venue: "NeurIPS",
    tags: ["transformers", "attention", "nlp"], status: "read", rating: 5,
    abstract: "We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.",
    url: "https://arxiv.org/abs/1706.03762", noteCount: 8,
    aiSummary: "Introduces the Transformer architecture replacing RNNs with self-attention. Key innovation: multi-head attention allows the model to attend to information from different representation subspaces simultaneously. Enables highly parallelizable training and achieves state-of-the-art on translation tasks.",
  },
  {
    id: 2, title: "An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale",
    authors: "Dosovitskiy et al.", year: 2020, venue: "ICLR 2021",
    tags: ["vision", "transformers", "vit"], status: "read", rating: 4,
    abstract: "While the Transformer architecture has become the de-facto standard for NLP tasks, its applications to computer vision remain limited.",
    url: "https://arxiv.org/abs/2010.11929", noteCount: 5,
    aiSummary: "ViT applies the Transformer architecture directly to image patches. Splits images into 16×16 patches, linearly embeds them, and passes through standard Transformer encoder. Achieves SOTA on ImageNet when pre-trained on large datasets.",
  },
  {
    id: 3, title: "Graph Neural Networks: A Review of Methods and Applications", authors: "Zhou et al.", year: 2020, venue: "AI Open",
    tags: ["gnn", "graphs", "survey"], status: "reading", rating: null,
    abstract: "Lots of learning tasks require dealing with graph data which contains rich relation information among elements.",
    url: "https://arxiv.org/abs/1812.08434", noteCount: 3, aiSummary: null,
  },
  {
    id: 4, title: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
    authors: "Devlin et al.", year: 2018, venue: "NAACL 2019",
    tags: ["bert", "nlp", "pre-training"], status: "read", rating: 5,
    abstract: "We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers.",
    url: "https://arxiv.org/abs/1810.04805", noteCount: 12,
    aiSummary: "BERT pre-trains deep bidirectional representations using masked language modeling (MLM) and next sentence prediction (NSP). Fine-tuning on downstream tasks achieves SOTA across 11 NLP benchmarks with minimal task-specific changes.",
  },
  {
    id: 5, title: "LLaMA: Open and Efficient Foundation Language Models", authors: "Touvron et al.", year: 2023, venue: "arXiv",
    tags: ["llm", "foundation-models", "open-source"], status: "to_read", rating: null,
    abstract: "We introduce LLaMA, a collection of foundation language models ranging from 7B to 65B parameters.",
    url: "https://arxiv.org/abs/2302.13971", noteCount: 0, aiSummary: null,
  },
  {
    id: 6, title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks", authors: "Lewis et al.", year: 2020, venue: "NeurIPS 2020",
    tags: ["rag", "retrieval", "nlp"], status: "to_read", rating: null,
    abstract: "Large pre-trained language models have been shown to store factual knowledge in their parameters.",
    url: "https://arxiv.org/abs/2005.11401", noteCount: 0, aiSummary: null,
  },
];

const STATUS_LABELS: Record<PaperStatus, string> = {
  to_read: "To Read", reading: "Reading", read: "Read", archived: "Archived",
};

const STATUS_COLORS: Record<PaperStatus, { dot: string; badge: string }> = {
  to_read:  { dot: "#E3D6BF", badge: "bg-[#E3D6BF]/10 text-[#E3D6BF]/70" },
  reading:  { dot: "#AABAAE", badge: "bg-[#AABAAE]/15 text-[#AABAAE]"    },
  read:     { dot: "#933B5B", badge: "bg-[#933B5B]/15 text-[#933B5B]"    },
  archived: { dot: "#1E1118", badge: "bg-white/5 text-[#E3D6BF]/30"      },
};

// ── Interactive Stars ─────────────────────────────────────────────────────────

function Stars({ rating, onRate }: { rating: number | null; onRate?: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || (rating ?? 0);

  return (
    <div className="flex items-center gap-0.5"
      onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n}
          onClick={() => onRate?.(n)}
          onMouseEnter={() => onRate && setHovered(n)}
          className={cn("transition-colors", onRate ? "cursor-pointer hover:scale-110" : "cursor-default")}
          disabled={!onRate}>
          <Star
            size={13}
            className={n <= active ? "text-[#933B5B] fill-[#933B5B]" : "text-[#E3D6BF]/15"}
          />
        </button>
      ))}
    </div>
  );
}

// ── Add Paper Modal ───────────────────────────────────────────────────────────

type AddPaperModalProps = { onClose: () => void; onAdd: (p: Omit<Paper, "id" | "noteCount" | "aiSummary">) => void };

function AddPaperModal({ onClose, onAdd }: AddPaperModalProps) {
  const [form, setForm] = useState({ title: "", authors: "", year: "", venue: "", url: "", tags: "", abstract: "" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onAdd({
      title: form.title, authors: form.authors,
      year: parseInt(form.year) || new Date().getFullYear(),
      venue: form.venue,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      status: "to_read", rating: null, abstract: form.abstract, url: form.url,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(21,13,17,0.7)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-lg rounded-2xl p-6"
        style={{ background: "#1A1016", border: "1px solid rgba(170,186,174,0.2)" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-light text-[#E3D6BF]" style={{ fontFamily: "var(--font-cormorant)" }}>Add Paper</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#E3D6BF]/40 hover:text-[#E3D6BF] hover:bg-white/5 transition-all">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {[
            { key: "title",   label: "Title *",   placeholder: "Paper title" },
            { key: "authors", label: "Authors",    placeholder: "Author 1, Author 2, ..." },
            { key: "venue",   label: "Venue",      placeholder: "NeurIPS 2024, arXiv, ..." },
            { key: "url",     label: "URL / DOI",  placeholder: "https://arxiv.org/abs/..." },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-[11px] text-[#E3D6BF]/50 mb-1">{label}</label>
              <input
                value={form[key as keyof typeof form]} onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 rounded-lg text-sm text-[#E3D6BF] placeholder-[#E3D6BF]/20 outline-none"
                style={{ background: "rgba(21,13,17,0.6)", border: "1px solid rgba(170,186,174,0.15)" }}
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#E3D6BF]/50 mb-1">Year</label>
              <input type="number" value={form.year} onChange={e => set("year", e.target.value)}
                placeholder={String(new Date().getFullYear())}
                className="w-full px-3 py-2 rounded-lg text-sm text-[#E3D6BF] placeholder-[#E3D6BF]/20 outline-none"
                style={{ background: "rgba(21,13,17,0.6)", border: "1px solid rgba(170,186,174,0.15)" }} />
            </div>
            <div>
              <label className="block text-[11px] text-[#E3D6BF]/50 mb-1">Tags</label>
              <input value={form.tags} onChange={e => set("tags", e.target.value)}
                placeholder="nlp, vision, ..."
                className="w-full px-3 py-2 rounded-lg text-sm text-[#E3D6BF] placeholder-[#E3D6BF]/20 outline-none"
                style={{ background: "rgba(21,13,17,0.6)", border: "1px solid rgba(170,186,174,0.15)" }} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-[#E3D6BF]/50 mb-1">Abstract</label>
            <textarea value={form.abstract} onChange={e => set("abstract", e.target.value)}
              placeholder="Paste abstract here..." rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm text-[#E3D6BF] placeholder-[#E3D6BF]/20 outline-none resize-none"
              style={{ background: "rgba(21,13,17,0.6)", border: "1px solid rgba(170,186,174,0.15)" }} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm text-[#E3D6BF]/50 hover:text-[#E3D6BF] transition-all"
              style={{ border: "1px solid rgba(170,186,174,0.15)" }}>
              Cancel
            </button>
            <button type="submit"
              className="flex-1 py-2 rounded-lg text-sm font-medium text-[#E3D6BF] transition-all"
              style={{ background: "#933B5B" }}>
              Add Paper
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Paper Row ─────────────────────────────────────────────────────────────────

function PaperRow({ paper, isExpanded, onToggle, onSetStatus, onRate, onSummaryGenerated, note, onNoteChange }: {
  paper: Paper;
  isExpanded: boolean;
  onToggle: () => void;
  onSetStatus: (s: PaperStatus) => void;
  onRate: (n: number) => void;
  onSummaryGenerated: (summary: string) => void;
  note: string;
  onNoteChange: (note: string) => void;
}) {
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  const sc = STATUS_COLORS[paper.status];

  const generateSummary = async () => {
    setGeneratingSummary(true);
    setSummaryError("");
    try {
      const res = await fetch("/api/ai/paper-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: paper.title, authors: paper.authors,
          year: paper.year, venue: paper.venue, abstract: paper.abstract,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onSummaryGenerated(data.summary);
    } catch (e) {
      setSummaryError(String(e));
    } finally {
      setGeneratingSummary(false);
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: "rgba(21,13,17,0.6)",
        border: `1px solid ${isExpanded ? "rgba(170,186,174,0.3)" : "rgba(170,186,174,0.12)"}`,
      }}>
      {/* Row header */}
      <button className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-white/2 transition-all"
        onClick={onToggle}>
        <div className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: sc.dot }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 mb-1">
            <p className="text-sm font-medium text-[#E3D6BF]/90 leading-snug flex-1">{paper.title}</p>
            <Stars rating={paper.rating} />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[11px] text-[#E3D6BF]/40">{paper.authors} · {paper.venue} · {paper.year}</span>
            {paper.tags.map(t => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-[#AABAAE]/10 text-[#AABAAE]">{t}</span>
            ))}
            {paper.noteCount > 0 && (
              <span className="text-[10px] text-[#E3D6BF]/30 flex items-center gap-1">
                <StickyNote size={9} /> {paper.noteCount}
              </span>
            )}
            {paper.aiSummary && (
              <span className="text-[10px] text-[#933B5B]/60 flex items-center gap-1">
                <Sparkles size={9} /> summarized
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", sc.badge)}>
            {STATUS_LABELS[paper.status]}
          </span>
          <ChevronDown size={14} className={cn("text-[#E3D6BF]/30 transition-transform duration-200", isExpanded && "rotate-180")} />
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-1 border-t border-[#AABAAE]/10 space-y-4">
          {/* Abstract */}
          {paper.abstract && (
            <p className="text-sm text-[#E3D6BF]/55 leading-relaxed">{paper.abstract}</p>
          )}

          {/* AI Summary */}
          {paper.aiSummary ? (
            <div className="rounded-xl px-4 py-3"
              style={{ background: "rgba(170,186,174,0.07)", borderLeft: "2px solid rgba(170,186,174,0.4)" }}>
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles size={11} className="text-[#AABAAE]" />
                <p className="text-[10px] font-semibold text-[#AABAAE] uppercase tracking-wider">AI Summary</p>
              </div>
              <p className="text-sm text-[#E3D6BF]/65 leading-relaxed">{paper.aiSummary}</p>
            </div>
          ) : (
            <div>
              {summaryError && (
                <div className="flex items-center gap-2 text-xs text-red-400 p-2 rounded-lg bg-red-900/15 mb-2">
                  <AlertCircle size={11} /> {summaryError}
                </div>
              )}
              <button onClick={generateSummary} disabled={generatingSummary}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-[#933B5B] transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: "rgba(147,59,91,0.12)", border: "1px solid rgba(147,59,91,0.25)" }}>
                {generatingSummary
                  ? <><Loader2 size={11} className="animate-spin" /> Summarising…</>
                  : <><Sparkles size={11} /> Get AI summary</>}
              </button>
            </div>
          )}

          {/* Your rating */}
          <div className="flex items-center gap-3">
            <p className="text-xs text-[#E3D6BF]/40">Your rating:</p>
            <Stars rating={paper.rating} onRate={onRate} />
            {paper.rating && (
              <span className="text-xs text-[#E3D6BF]/30">{paper.rating}/5</span>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-[#E3D6BF]/40 mb-1.5 flex items-center gap-1.5">
              <StickyNote size={11} /> Notes
            </label>
            <textarea
              value={note}
              onChange={e => onNoteChange(e.target.value)}
              placeholder="Add your notes, highlights, or key takeaways…"
              rows={3}
              className="w-full px-3 py-2 rounded-xl text-sm text-[#E3D6BF] placeholder:text-[#E3D6BF]/20 outline-none resize-none transition-all"
              style={{ background: "rgba(30,17,24,0.4)", border: "1px solid rgba(170,186,174,0.12)" }}
            />
          </div>

          {/* Status + open link */}
          <div className="flex items-center gap-2 flex-wrap">
            {(["to_read", "reading", "read", "archived"] as PaperStatus[]).map(s => (
              <button key={s} onClick={() => onSetStatus(s)}
                className={cn(
                  "text-[11px] px-3 py-1 rounded-lg transition-all",
                  paper.status === s
                    ? "bg-[#933B5B]/20 text-[#933B5B]"
                    : "text-[#E3D6BF]/40 hover:text-[#E3D6BF]/70 hover:bg-white/5"
                )}>
                {STATUS_LABELS[s]}
              </button>
            ))}
            <div className="flex-1" />
            {paper.url && (
              <a href={paper.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-[#AABAAE] hover:text-[#E3D6BF] transition-colors">
                <ExternalLink size={12} /> Open paper
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResearchPage() {
  const [papers, setPapers] = useState<Paper[]>(INITIAL_PAPERS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaperStatus | "all">("all");
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});

  const addPaper = (p: Omit<Paper, "id" | "noteCount" | "aiSummary">) => {
    setPapers(prev => [{ ...p, id: Date.now(), noteCount: 0, aiSummary: null }, ...prev]);
  };

  const setStatus = (id: number, s: PaperStatus) => {
    setPapers(prev => prev.map(p => p.id === id ? { ...p, status: s } : p));
  };

  const setRating = (id: number, n: number) => {
    setPapers(prev => prev.map(p => p.id === id ? { ...p, rating: p.rating === n ? null : n } : p));
  };

  const setSummary = (id: number, summary: string) => {
    setPapers(prev => prev.map(p => p.id === id ? { ...p, aiSummary: summary } : p));
  };

  const filtered = papers.filter(p => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) &&
        !p.authors.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all: papers.length,
    to_read: papers.filter(p => p.status === "to_read").length,
    reading: papers.filter(p => p.status === "reading").length,
    read: papers.filter(p => p.status === "read").length,
    archived: papers.filter(p => p.status === "archived").length,
  };

  return (
    <div className="space-y-6">
      {showModal && <AddPaperModal onClose={() => setShowModal(false)} onAdd={addPaper} />}

      {/* Header */}
      <div className="flex items-center justify-between fade-in">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <BookOpen size={20} className="text-[#AABAAE]" />
            <h1 className="text-4xl font-light text-[#E3D6BF]" style={{ fontFamily: "var(--font-cormorant)" }}>
              Research Hub
            </h1>
          </div>
          <p className="text-sm text-[#E3D6BF]/50">
            {counts.read} read · {counts.reading} reading · {counts.to_read} queued
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-[#E3D6BF] transition-all hover:brightness-110"
          style={{ background: "#933B5B" }}>
          <Plus size={15} /> Add Paper
        </button>
      </div>

      {/* Status filter cards */}
      <div className="grid grid-cols-4 gap-3">
        {(["to_read", "reading", "read", "archived"] as PaperStatus[]).map(s => (
          <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
            className={cn(
              "rounded-xl p-4 text-left transition-all border",
              statusFilter === s ? "border-[#AABAAE]/40" : "border-transparent hover:border-[#AABAAE]/15",
            )}
            style={{ background: statusFilter === s ? "rgba(170,186,174,0.1)" : "rgba(21,13,17,0.5)" }}>
            <p className="text-2xl font-light text-[#E3D6BF] mb-0.5" style={{ fontFamily: "var(--font-cormorant)" }}>
              {counts[s]}
            </p>
            <p className="text-[11px] text-[#E3D6BF]/50">{STATUS_LABELS[s]}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
        style={{ background: "rgba(21,13,17,0.6)", border: "1px solid rgba(170,186,174,0.15)" }}>
        <Search size={14} className="text-[#E3D6BF]/30 shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search papers by title or author…"
          className="flex-1 bg-transparent text-sm text-[#E3D6BF] placeholder-[#E3D6BF]/25 outline-none" />
        {search && (
          <button onClick={() => setSearch("")} className="text-[#E3D6BF]/30 hover:text-[#E3D6BF]/60">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Paper list */}
      <div className="space-y-2">
        {filtered.map(paper => (
          <PaperRow
            key={paper.id}
            paper={paper}
            isExpanded={expanded === paper.id}
            onToggle={() => setExpanded(expanded === paper.id ? null : paper.id)}
            onSetStatus={s => setStatus(paper.id, s)}
            onRate={n => setRating(paper.id, n)}
            onSummaryGenerated={s => setSummary(paper.id, s)}
            note={notes[paper.id] ?? ""}
            onNoteChange={n => setNotes(prev => ({ ...prev, [paper.id]: n }))}
          />
        ))}

        {filtered.length === 0 && (
          <div className="rounded-2xl p-12 text-center"
            style={{ background: "rgba(21,13,17,0.4)", border: "1px solid rgba(170,186,174,0.1)" }}>
            <FileText size={32} className="text-[#E3D6BF]/15 mx-auto mb-3" />
            <p className="text-sm text-[#E3D6BF]/30">
              {search ? "No papers match your search." : "No papers yet. Add your first one!"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
