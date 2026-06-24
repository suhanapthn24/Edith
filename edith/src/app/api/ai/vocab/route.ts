import { NextRequest, NextResponse } from "next/server";
import { openRouter, extractJSON } from "@/lib/openrouter";

export async function POST(req: NextRequest) {
  try {
    const { language, cefr, prompt: userPrompt, count = 10 } = await req.json();

    const content = await openRouter([
      {
        role: "system",
        content: "You are an expert language teacher. Always respond with valid JSON only — no markdown, no extra text.",
      },
      {
        role: "user",
        content: `Generate ${count} vocabulary flashcards for a ${cefr}-level ${language} learner.

What to generate: ${userPrompt}

Return a JSON array exactly matching this schema:
[
  {
    "word": "the word or phrase in ${language}",
    "translation": "English meaning",
    "pronunciation": "IPA or romanized pronunciation (e.g. /sə su.vniʁ/ for French, 'marḥaban' for Arabic)",
    "example": "a natural example sentence in ${language}",
    "exampleTranslation": "English translation of the example sentence",
    "gender": "m, f, or n only if the language has grammatical gender — omit otherwise",
    "tags": ["part of speech (noun/verb/adj/adverb/phrase)", "${cefr}", "topic"]
  }
]

Requirements:
- Words must be authentic, useful, and correctly spelled in ${language}
- Pronunciations must be accurate
- Examples should be natural, not constructed
- Mix nouns, verbs, adjectives, and phrases
- All ${count} cards must be distinct
- No duplicate meanings`,
      },
    ], { temperature: 0.8, maxTokens: 3000 });

    const cards = extractJSON(content) as unknown[];
    const now = new Date().toISOString().split("T")[0];

    const normalized = (Array.isArray(cards) ? cards : []).map((c: unknown, i: number) => {
      const card = c as Record<string, unknown>;
      return {
        id: Date.now() + i,
        word: String(card.word ?? ""),
        translation: String(card.translation ?? ""),
        pronunciation: card.pronunciation ? String(card.pronunciation) : undefined,
        example: card.example ? String(card.example) : undefined,
        exampleTranslation: card.exampleTranslation ? String(card.exampleTranslation) : undefined,
        gender: card.gender ? String(card.gender) : undefined,
        tags: Array.isArray(card.tags) ? card.tags.map(String) : [],
        repetitions: 0,
        easeFactor: 2.5,
        nextReview: now,
        aiGenerated: true,
      };
    });

    return NextResponse.json(normalized);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
