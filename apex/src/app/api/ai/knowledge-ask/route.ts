import { NextRequest, NextResponse } from "next/server";
import { openRouter } from "@/lib/openrouter";

interface DocContext {
  title: string;
  type: string;
  tags: string[];
  excerpt: string;
}

export async function POST(req: NextRequest) {
  try {
    const { question, documents }: { question: string; documents: DocContext[] } =
      await req.json();

    const docsContext = documents
      .map(
        (d, i) =>
          `[${i + 1}] "${d.title}" (${d.type}, tags: ${d.tags.join(", ")})\n    ${d.excerpt}`
      )
      .join("\n\n");

    const content = await openRouter(
      [
        {
          role: "system",
          content:
            "You are a personal knowledge assistant. Answer questions based exclusively on the user's document library provided. Be specific, cite document titles when relevant, and be concise. If the answer is not covered by the documents, say so clearly and briefly.",
        },
        {
          role: "user",
          content: `My document library (${documents.length} items):

${docsContext}

Question: ${question}

Answer based only on the documents above. Reference document titles in your answer (e.g., "According to your notes on X..." or "In [Title]..."). Keep your answer to 2-4 paragraphs.`,
        },
      ],
      { temperature: 0.3, maxTokens: 800 }
    );

    const sources = documents
      .filter((d) =>
        content.toLowerCase().includes(d.title.toLowerCase().slice(0, 25))
      )
      .map((d) => d.title);

    return NextResponse.json({ answer: content, sources });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
