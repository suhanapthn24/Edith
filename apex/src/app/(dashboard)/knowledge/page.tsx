"use client";

import { useState, useMemo } from "react";
import {
  Brain, FileText, Globe, StickyNote, Video, BookOpen,
  Plus, Search, X, Send, Loader2, Sparkles, AlertCircle,
  ChevronDown, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type DocType = "pdf" | "article" | "note" | "video" | "book";
type Tab = "library" | "ask" | "notes";

interface KnowledgeDoc {
  id: number;
  title: string;
  type: DocType;
  tags: string[];
  excerpt: string;
  url?: string;
  dateAdded: string;
  wordCount?: number;
  source?: string;
}

interface Message {
  role: "user" | "ai";
  content: string;
  sources?: string[];
}

// ── Mock data ────────────────────────────────────────────────────────────────

const INITIAL_DOCS: KnowledgeDoc[] = [
  {
    id: 1,
    title: "Attention Is All You Need — Study Notes",
    type: "note",
    tags: ["transformers", "nlp", "deep-learning", "attention"],
    excerpt:
      "Self-attention allows relating different positions of a sequence in O(1) operations. Multi-head attention runs h attention functions in parallel. Key insight: no recurrence needed — parallelizable across positions.",
    dateAdded: "2026-06-01",
    wordCount: 1200,
  },
  {
    id: 2,
    title: "CS229: Machine Learning — Lecture Notes",
    type: "pdf",
    tags: ["machine-learning", "stanford", "supervised-learning", "statistics"],
    excerpt:
      "Supervised learning, linear regression, logistic regression, SVMs, and neural networks. Gradient descent variants, regularization (L1/L2), bias-variance tradeoff. Notes from Stanford ML by Andrew Ng.",
    dateAdded: "2026-05-15",
    source: "Stanford",
    wordCount: 8500,
  },
  {
    id: 3,
    title: "Designing Data-Intensive Applications",
    type: "book",
    tags: ["distributed-systems", "databases", "architecture", "consistency"],
    excerpt:
      "Reliable, scalable, and maintainable applications. Covers data models, storage engines, replication, partitioning, transactions, and consistency models (CAP theorem, ACID vs BASE).",
    dateAdded: "2026-05-01",
    wordCount: 120000,
  },
  {
    id: 4,
    title: "How I Built a RAG System in 3 Days",
    type: "article",
    tags: ["rag", "llm", "vector-db", "langchain", "embeddings"],
    excerpt:
      "Step-by-step guide to retrieval-augmented generation using LangChain, FAISS, and OpenAI embeddings. Chunking strategy: 512 tokens with 50-token overlap. Key lesson: retrieval quality matters more than generation quality.",
    dateAdded: "2026-06-10",
    url: "https://towardsdatascience.com",
    source: "Towards Data Science",
  },
  {
    id: 5,
    title: "MIT 6.006: Introduction to Algorithms",
    type: "video",
    tags: ["algorithms", "dsa", "mit", "dynamic-programming", "graphs"],
    excerpt:
      "Lecture recordings. Key topics: dynamic programming (memoization vs tabulation), graph algorithms (BFS, DFS, Dijkstra, Bellman-Ford), shortest paths, and advanced data structures (B-trees, van Emde Boas).",
    dateAdded: "2026-04-20",
    source: "MIT OpenCourseWare",
  },
  {
    id: 6,
    title: "The Pragmatic Programmer",
    type: "book",
    tags: ["software-engineering", "best-practices", "career", "clean-code"],
    excerpt:
      "DRY principle, orthogonality, tracer bullets, design by contract. Key insight: software entropy — fixing broken windows early prevents decline. Invest regularly in your knowledge portfolio.",
    dateAdded: "2026-03-10",
    wordCount: 95000,
  },
  {
    id: 7,
    title: "LangChain & LCEL — Pattern Notes",
    type: "note",
    tags: ["langchain", "llm", "python", "rag", "agents"],
    excerpt:
      "LCEL (LangChain Expression Language): composable chains with pipe operator. Key patterns: RunnableSequence, RunnableParallel, with_fallbacks. Agents: ReAct loop with tool use. Memory: ConversationBufferWindowMemory for multi-turn.",
    dateAdded: "2026-06-14",
    wordCount: 3200,
  },
  {
    id: 8,
    title: "Business Analytics: Core Frameworks",
    type: "pdf",
    tags: ["analytics", "business", "statistics", "decision-making"],
    excerpt:
      "Descriptive, predictive, and prescriptive analytics. A/B testing, regression analysis, cohort analysis, funnel metrics. Key metric frameworks: AARRR (Pirate metrics), North Star metric identification.",
    dateAdded: "2026-05-28",
    source: "Course textbook",
    wordCount: 45000,
  },
];

// ── Styles ────────────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<
  DocType,
  { icon: React.ElementType; bg: string; text: string; label: string }
> = {
  pdf:     { icon: FileText,  bg: "bg-[#933B5B]/15", text: "text-[#933B5B]",      label: "PDF"     },
  article: { icon: Globe,     bg: "bg-[#AABAAE]/15", text: "text-[#AABAAE]",      label: "Article" },
  note:    { icon: StickyNote,bg: "bg-[#E3D6BF]/12", text: "text-[#E3D6BF]/80",   label: "Note"    },
  video:   { icon: Video,     bg: "bg-blue-900/20",  text: "text-blue-400",        label: "Video"   },
  book:    { icon: BookOpen,  bg: "bg-amber-900/20", text: "text-amber-400/80",    label: "Book"    },
};

const NOTES_KEY = "apex_knowledge_notes";

// ── Add Document Modal ────────────────────────────────────────────────────────

function AddDocModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (doc: KnowledgeDoc) => void;
}) {
  const [form, setForm] = useState({
    title: "",
    type: "article" as DocType,
    url: "",
    source: "",
    tags: "",
    excerpt: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    onAdd({
      id: Date.now(),
      title: form.title,
      type: form.type,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      excerpt: form.excerpt || "No description provided.",
      url: form.url || undefined,
      source: form.source || undefined,
      dateAdded: new Date().toISOString().slice(0, 10),
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(21,13,17,0.85)", backdropFilter: "blur(4px)" }}
    >
      <div className="bg-[#150D11] rounded-2xl w-full max-w-lg border border-[#E3D6BF]/10 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3
            className="text-xl font-light text-[#E3D6BF]"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            Add to Knowledge Vault
          </h3>
          <button
            onClick={onClose}
            className="text-[#E3D6BF]/40 hover:text-[#E3D6BF]/80 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="text-xs text-[#AABAAE] mb-1 block"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              Title *
            </label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Document title"
              required
              className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="text-xs text-[#AABAAE] mb-1 block"
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                Type
              </label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, type: e.target.value as DocType }))
                }
                className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none"
              >
                {Object.entries(TYPE_STYLES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="text-xs text-[#AABAAE] mb-1 block"
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                Source / Publisher
              </label>
              <input
                value={form.source}
                onChange={(e) =>
                  setForm((f) => ({ ...f, source: e.target.value }))
                }
                placeholder="e.g. arXiv, MIT"
                className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none"
                style={{ fontFamily: "var(--font-dm-sans)" }}
              />
            </div>
          </div>
          <div>
            <label
              className="text-xs text-[#AABAAE] mb-1 block"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              URL (optional)
            </label>
            <input
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="https://..."
              className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            />
          </div>
          <div>
            <label
              className="text-xs text-[#AABAAE] mb-1 block"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              Tags (comma-separated)
            </label>
            <input
              value={form.tags}
              onChange={(e) =>
                setForm((f) => ({ ...f, tags: e.target.value }))
              }
              placeholder="nlp, transformers, deep-learning"
              className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            />
          </div>
          <div>
            <label
              className="text-xs text-[#AABAAE] mb-1 block"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              Description / Key Notes
            </label>
            <textarea
              value={form.excerpt}
              onChange={(e) =>
                setForm((f) => ({ ...f, excerpt: e.target.value }))
              }
              rows={3}
              placeholder="Brief summary, key takeaways, or main ideas..."
              className="w-full bg-[#1E1118]/50 rounded-lg px-3 py-2 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none resize-none"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[#E3D6BF]/50 hover:text-[#E3D6BF]/80 transition-colors"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm rounded-lg bg-[#933B5B]/20 text-[#933B5B] hover:bg-[#933B5B]/30 transition-all border border-[#933B5B]/20"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              Add Document
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Library Tab ───────────────────────────────────────────────────────────────

function LibraryTab({
  docs,
  onAdd,
}: {
  docs: KnowledgeDoc[];
  onAdd: (doc: KnowledgeDoc) => void;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocType | "all">("all");
  const [tagFilter, setTagFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const allTags = useMemo(
    () => Array.from(new Set(docs.flatMap((d) => d.tags))).sort(),
    [docs]
  );

  const filtered = useMemo(() => {
    let result = docs;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.excerpt.toLowerCase().includes(q) ||
          d.tags.some((t) => t.includes(q))
      );
    }
    if (typeFilter !== "all") result = result.filter((d) => d.type === typeFilter);
    if (tagFilter) result = result.filter((d) => d.tags.includes(tagFilter));
    return result;
  }, [docs, search, typeFilter, tagFilter]);

  return (
    <>
      {showAdd && (
        <AddDocModal onClose={() => setShowAdd(false)} onAdd={onAdd} />
      )}
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AABAAE]/50"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents, tags, content..."
              className="w-full bg-[#150D11] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none placeholder:text-[#E3D6BF]/30"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            />
          </div>
          <div className="flex gap-2">
            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as DocType | "all")
              }
              className="bg-[#150D11] rounded-xl px-3 py-2.5 text-sm text-[#E3D6BF]/70 border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              <option value="all">All types</option>
              {Object.entries(TYPE_STYLES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#933B5B]/20 text-[#933B5B] hover:bg-[#933B5B]/30 transition-all border border-[#933B5B]/20 text-sm font-medium shrink-0"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        {/* Tag chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setTagFilter("")}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs border transition-all",
              tagFilter === ""
                ? "bg-[#AABAAE]/20 text-[#AABAAE] border-[#AABAAE]/40"
                : "border-[#E3D6BF]/10 text-[#E3D6BF]/40 hover:border-[#E3D6BF]/20 hover:text-[#E3D6BF]/60"
            )}
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            All
          </button>
          {allTags.slice(0, 14).map((tag) => (
            <button
              key={tag}
              onClick={() => setTagFilter(tag === tagFilter ? "" : tag)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs border transition-all",
                tagFilter === tag
                  ? "bg-[#AABAAE]/20 text-[#AABAAE] border-[#AABAAE]/40"
                  : "border-[#E3D6BF]/10 text-[#E3D6BF]/40 hover:border-[#E3D6BF]/20 hover:text-[#E3D6BF]/60"
              )}
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              {tag}
            </button>
          ))}
        </div>

        <p
          className="text-xs text-[#E3D6BF]/40"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          {filtered.length} document{filtered.length !== 1 ? "s" : ""}
        </p>

        {/* Document list */}
        <div className="space-y-2">
          {filtered.map((doc) => {
            const style = TYPE_STYLES[doc.type];
            const Icon = style.icon;
            const isExpanded = expanded === doc.id;
            return (
              <div
                key={doc.id}
                className="bg-[#150D11] rounded-xl border border-[#E3D6BF]/8 overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpanded(isExpanded ? null : doc.id)
                  }
                  className="w-full text-left p-4 flex items-start gap-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div
                    className={cn("p-2 rounded-lg shrink-0 mt-0.5", style.bg)}
                  >
                    <Icon size={14} className={style.text} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className="text-sm font-medium text-[#E3D6BF]/90 leading-snug"
                        style={{ fontFamily: "var(--font-dm-sans)" }}
                      >
                        {doc.title}
                      </p>
                      <ChevronDown
                        size={14}
                        className={cn(
                          "text-[#E3D6BF]/30 shrink-0 mt-0.5 transition-transform duration-200",
                          isExpanded && "rotate-180"
                        )}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span
                        className={cn(
                          "text-xs px-1.5 py-0.5 rounded",
                          style.bg,
                          style.text
                        )}
                      >
                        {style.label}
                      </span>
                      {doc.source && (
                        <span
                          className="text-xs text-[#E3D6BF]/40"
                          style={{ fontFamily: "var(--font-dm-sans)" }}
                        >
                          {doc.source}
                        </span>
                      )}
                      <span
                        className="text-xs text-[#E3D6BF]/30"
                        style={{ fontFamily: "var(--font-dm-sans)" }}
                      >
                        {doc.dateAdded}
                      </span>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-[#E3D6BF]/5 pt-3 space-y-3">
                    <p
                      className="text-sm text-[#E3D6BF]/60 leading-relaxed"
                      style={{ fontFamily: "var(--font-dm-sans)" }}
                    >
                      {doc.excerpt}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {doc.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 rounded-full bg-[#AABAAE]/10 text-[#AABAAE]/80 border border-[#AABAAE]/20"
                          style={{ fontFamily: "var(--font-dm-sans)" }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-4">
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#933B5B] hover:text-[#933B5B]/80 transition-colors flex items-center gap-1"
                          style={{ fontFamily: "var(--font-dm-sans)" }}
                        >
                          <ExternalLink size={11} /> Open source
                        </a>
                      )}
                      {doc.wordCount && (
                        <span
                          className="text-xs text-[#E3D6BF]/30"
                          style={{ fontFamily: "var(--font-dm-sans)" }}
                        >
                          {doc.wordCount.toLocaleString()} words
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div
              className="text-center py-16 text-[#E3D6BF]/30 text-sm"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              No documents found.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Ask AI Tab ────────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "What do I know about transformer architectures?",
  "Summarize my notes on RAG systems",
  "What distributed systems concepts have I studied?",
  "Key software engineering principles from my books?",
];

function AskTab({ docs }: { docs: KnowledgeDoc[] }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk() {
    if (!question.trim() || loading) return;
    const q = question.trim();
    setQuestion("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/knowledge-ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, documents: docs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: data.answer, sources: data.sources },
      ]);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#150D11]/60 rounded-2xl border border-[#933B5B]/20 p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Sparkles size={14} className="text-[#933B5B]" />
          <span
            className="text-xs font-medium text-[#933B5B]"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            Searching {docs.length} documents
          </span>
        </div>
        <p
          className="text-xs text-[#E3D6BF]/40"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          Ask questions about anything in your library. The AI searches through
          your documents and synthesizes an answer.
        </p>
      </div>

      {messages.length === 0 && (
        <div>
          <p
            className="text-xs text-[#E3D6BF]/40 mb-2"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            Try asking
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setQuestion(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-[#E3D6BF]/10 text-[#E3D6BF]/50 hover:border-[#AABAAE]/40 hover:text-[#AABAAE] transition-all"
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversation */}
      <div className="space-y-3 max-h-[50vh] overflow-y-auto">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3",
                msg.role === "user"
                  ? "bg-[#933B5B]/20 text-[#E3D6BF]"
                  : "bg-[#150D11] border border-[#E3D6BF]/8 text-[#E3D6BF]/80"
              )}
            >
              <p
                className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                {msg.content}
              </p>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#E3D6BF]/8">
                  <p
                    className="text-xs text-[#AABAAE]/60 mb-1"
                    style={{ fontFamily: "var(--font-dm-sans)" }}
                  >
                    Sources:
                  </p>
                  {msg.sources.map((s) => (
                    <p
                      key={s}
                      className="text-xs text-[#AABAAE]"
                      style={{ fontFamily: "var(--font-dm-sans)" }}
                    >
                      • {s}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#150D11] border border-[#E3D6BF]/8 rounded-2xl px-4 py-3">
              <Loader2 size={14} className="animate-spin text-[#AABAAE]" />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-[#933B5B] bg-[#933B5B]/10 border border-[#933B5B]/20 rounded-xl px-3 py-2">
          <AlertCircle size={12} />
          {error}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && !e.shiftKey && handleAsk()
          }
          placeholder="Ask anything about your knowledge base..."
          className="flex-1 bg-[#150D11] rounded-xl px-4 py-2.5 text-sm text-[#E3D6BF] border border-[#E3D6BF]/10 focus:border-[#AABAAE]/50 focus:outline-none placeholder:text-[#E3D6BF]/30"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        />
        <button
          onClick={handleAsk}
          disabled={loading || !question.trim()}
          className="px-4 py-2.5 rounded-xl bg-[#933B5B]/20 text-[#933B5B] hover:bg-[#933B5B]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all border border-[#933B5B]/20"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Notes Tab ─────────────────────────────────────────────────────────────────

function NotesTab() {
  const [notes, setNotes] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(NOTES_KEY) ?? "";
    }
    return "";
  });

  function handleChange(val: string) {
    setNotes(val);
    if (typeof window !== "undefined") {
      localStorage.setItem(NOTES_KEY, val);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p
          className="text-xs text-[#E3D6BF]/40"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          Quick scratchpad — auto-saved to your browser
        </p>
        <span
          className="text-xs text-[#E3D6BF]/20"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          {notes.length} chars
        </span>
      </div>
      <textarea
        value={notes}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={`Ideas, connections between topics, reading summaries...\n\nE.g.:\n- Transformers use self-attention instead of RNNs → enables parallelization\n- DDIA: CAP theorem means you must choose between consistency and availability during network partitions\n- RAG = retrieval + generation — quality of retrieval matters most`}
        className="w-full bg-[#150D11] rounded-2xl p-5 text-sm text-[#E3D6BF]/80 border border-[#E3D6BF]/8 focus:border-[#AABAAE]/40 focus:outline-none placeholder:text-[#E3D6BF]/20 resize-none leading-relaxed"
        style={{
          fontFamily: "var(--font-dm-sans)",
          minHeight: "calc(100vh - 340px)",
        }}
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "library", label: "Library" },
  { id: "ask", label: "Ask AI" },
  { id: "notes", label: "Quick Notes" },
];

export default function KnowledgePage() {
  const [tab, setTab] = useState<Tab>("library");
  const [docs, setDocs] = useState<KnowledgeDoc[]>(INITIAL_DOCS);

  const typeCounts = useMemo(
    () =>
      (["pdf", "article", "note", "video", "book"] as DocType[]).reduce(
        (acc, t) => ({ ...acc, [t]: docs.filter((d) => d.type === t).length }),
        {} as Record<DocType, number>
      ),
    [docs]
  );

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div>
        <p
          className="text-xs font-medium tracking-[0.1em] uppercase text-[#AABAAE]/70 mb-1"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          Module 6
        </p>
        <h1
          className="text-4xl font-light text-[#E3D6BF]"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          Knowledge Vault
        </h1>
        <p
          className="text-sm text-[#E3D6BF]/50 mt-1"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          {docs.length} documents indexed — ask questions across your entire
          library.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3">
        {(["pdf", "article", "note", "video", "book"] as DocType[]).map(
          (type) => {
            const style = TYPE_STYLES[type];
            const Icon = style.icon;
            return (
              <div
                key={type}
                className="bg-[#150D11] rounded-xl p-3 border border-[#E3D6BF]/8 flex items-center gap-2"
              >
                <div className={cn("p-1.5 rounded-lg shrink-0", style.bg)}>
                  <Icon size={13} className={style.text} />
                </div>
                <div>
                  <p
                    className="text-xl font-light text-[#E3D6BF] leading-none"
                    style={{ fontFamily: "var(--font-cormorant)" }}
                  >
                    {typeCounts[type]}
                  </p>
                  <p
                    className="text-xs text-[#E3D6BF]/40 mt-0.5"
                    style={{ fontFamily: "var(--font-dm-sans)" }}
                  >
                    {style.label}s
                  </p>
                </div>
              </div>
            );
          }
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#150D11]/40 rounded-xl p-1 w-fit border border-[#E3D6BF]/8">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm transition-all",
              tab === t.id
                ? "bg-[#1E1118] text-[#E3D6BF] shadow-sm"
                : "text-[#E3D6BF]/40 hover:text-[#E3D6BF]/70"
            )}
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "library" && (
        <LibraryTab docs={docs} onAdd={(doc) => setDocs((p) => [doc, ...p])} />
      )}
      {tab === "ask" && <AskTab docs={docs} />}
      {tab === "notes" && <NotesTab />}
    </div>
  );
}
