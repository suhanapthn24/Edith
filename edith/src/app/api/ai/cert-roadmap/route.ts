import { NextRequest, NextResponse } from "next/server";
import { openRouter, extractJSON } from "@/lib/openrouter";

export async function POST(req: NextRequest) {
  try {
    const { certification, provider, currentLevel, hoursPerDay, examDate } =
      await req.json();

    const content = await openRouter(
      [
        {
          role: "system",
          content:
            "You are a certification exam expert and study planner. Generate precise, actionable study plans based on official exam domains. Always respond with valid JSON only — no markdown, no extra text.",
        },
        {
          role: "user",
          content: `Generate a detailed study plan for: ${provider} — ${certification}

Current knowledge level: ${currentLevel}
Available study time: ${hoursPerDay} hours per day
${examDate ? `Target exam date: ${examDate}` : "No specific exam date — plan for efficient completion"}

Return JSON with this exact schema:
{
  "phases": [
    {
      "phaseNumber": 1,
      "title": "Foundations",
      "weeks": "Week 1-2",
      "hoursRequired": 14,
      "topics": ["Topic A", "Topic B", "Topic C"],
      "goals": ["Be able to explain X", "Understand Y"],
      "resources": ["Official docs: section Z", "Course: Chapter 3"],
      "practiceTests": false,
      "milestone": "Complete foundation quiz with 70%+"
    }
  ],
  "totalWeeks": 8,
  "totalHours": 112,
  "dailySchedule": "2 hrs/day: 1h new content + 30min review + 30min practice",
  "examReadinessChecklist": ["Scoring 80%+ on 3 consecutive practice exams", "..."],
  "tips": ["Focus on hands-on labs for X domain", "..."]
}

Generate 4-6 phases covering all major exam domains. The final phase must be practice tests + weak area review.`,
        },
      ],
      { temperature: 0.45, maxTokens: 2000 }
    );

    const plan = extractJSON(content);
    return NextResponse.json({ plan });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
