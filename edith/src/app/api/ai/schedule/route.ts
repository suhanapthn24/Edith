import { NextRequest, NextResponse } from "next/server";
import { openRouter, extractJSON } from "@/lib/openrouter";

export async function POST(req: NextRequest) {
  try {
    const { prompt, weekDates } = await req.json();

    const content = await openRouter([
      {
        role: "system",
        content: "You are a smart study schedule assistant. Parse the user's request and generate calendar events. Always respond with valid JSON only — no markdown, no extra text.",
      },
      {
        role: "user",
        content: `The user wants to schedule study sessions. Their request: "${prompt}"

Week dates available: ${weekDates.join(", ")} (format: YYYY-MM-DD, Monday first)

Return a JSON array of calendar events matching this schema:
[
  {
    "title": "French vocabulary review",
    "date": "2026-06-16",
    "startTime": "08:00",
    "endTime": "08:20",
    "type": "study",
    "description": "SM-2 spaced repetition review"
  }
]

Types allowed: "study", "review", "reading", "practice", "break", "deadline"

Rules:
- Only schedule events on dates from the provided week
- Times should be between 07:00 and 22:00
- Be specific about start and end times (24h format HH:MM)
- If the user says "every day", create one event per weekday
- Match the duration to what the user requests
- If no specific time is given, schedule at reasonable morning/afternoon times
- Title should be short and descriptive
- Return 1-14 events maximum`,
      },
    ], { temperature: 0.5, maxTokens: 1500 });

    const events = extractJSON(content);
    return NextResponse.json({ events: Array.isArray(events) ? events : [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
