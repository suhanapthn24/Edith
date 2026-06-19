import { NextRequest, NextResponse } from "next/server";
import { openRouter } from "@/lib/openrouter";

export async function POST(req: NextRequest) {
  try {
    const { title, authors, year, venue, abstract } = await req.json();

    const summary = await openRouter([
      {
        role: "system",
        content: "You are an expert research assistant. Write clear, concise academic paper summaries for students. Focus on the key problem, method, and results. Be specific and informative. 3-5 sentences.",
      },
      {
        role: "user",
        content: `Summarize this research paper:

Title: ${title}
Authors: ${authors}
Year: ${year} · Venue: ${venue}
Abstract: ${abstract}

Write a clear 3-5 sentence summary covering: (1) what problem it solves, (2) the core method or innovation, and (3) the key results or impact. Be specific — mention actual techniques, architectures, or metrics where relevant.`,
      },
    ], { temperature: 0.4, maxTokens: 400 });

    return NextResponse.json({ summary: summary.trim() });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
