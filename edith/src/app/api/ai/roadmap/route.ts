import { NextRequest, NextResponse } from "next/server";
import { openRouter, extractJSON } from "@/lib/openrouter";

export async function POST(req: NextRequest) {
  try {
    const { language, cefr, targetCefr = "C2", dailyGoalMins = 15 } = await req.json();

    const content = await openRouter([
      {
        role: "system",
        content: "You are an expert language learning coach. Always respond with valid JSON only — no markdown, no extra text.",
      },
      {
        role: "user",
        content: `Generate a structured learning roadmap for someone studying ${language}.

Current level: ${cefr}
Target level: ${targetCefr}
Daily study time: ${dailyGoalMins} minutes per day

Return a JSON object exactly matching this schema:
{
  "phases": [
    {
      "level": "B1",
      "title": "Intermediate",
      "durationWeeks": 10,
      "vocabTarget": 2000,
      "topics": ["Past tense verbs", "Expressing opinions", "Travel vocabulary", "Conditional sentences"],
      "weeklyGoals": ["Learn 40 new words via spaced repetition", "Complete 2 grammar exercises", "Watch 1 native video with subtitles"],
      "resources": ["Anki deck for ${language}", "Language transfer audio course", "italki tutor (1x/week optional)"],
      "milestone": "Can discuss familiar topics, read simple texts, write short messages"
    }
  ],
  "totalWeeks": 52,
  "totalVocabGoal": 5000,
  "tips": ["Focus on high-frequency words first", "Use spaced repetition daily", "Speak from day 1 even if imperfect"]
}

Include phases starting from ${cefr} through ${targetCefr}. Be specific and realistic about durations and vocabulary targets. Include 3-5 phases.`,
      },
    ], { temperature: 0.6, maxTokens: 2500 });

    const roadmap = extractJSON(content);
    return NextResponse.json(roadmap);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
