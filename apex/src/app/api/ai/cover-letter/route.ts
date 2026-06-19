import { NextRequest, NextResponse } from "next/server";
import { openRouter } from "@/lib/openrouter";

export async function POST(req: NextRequest) {
  try {
    const { role, company, jobDesc, background } = await req.json();

    const content = await openRouter(
      [
        {
          role: "system",
          content:
            "You are an expert career coach who writes compelling, personalized cover letters. Write naturally, avoid clichés, and focus on genuine value the candidate brings. Never use generic openers.",
        },
        {
          role: "user",
          content: `Write a professional cover letter for this opportunity:

Role: ${role}
Company: ${company}
Job Description Highlights: ${jobDesc}
My Background: ${background}

Requirements:
- 3-4 paragraphs, ~280-350 words total
- Opening paragraph: specific hook referencing something real about the company or role (not "I am writing to apply for")
- Middle (2 paragraphs): 2-3 specific, concrete examples connecting background to role requirements
- Closing: confident, concise call to action
- Tone: professional but warm — not stiff, not generic
- Do NOT use: "I am a passionate professional", "perfect fit", "I believe my skills align", "I am excited to"
- Output only the letter body paragraphs — no greeting, no sign-off, no "Dear X" or "Sincerely"`,
        },
      ],
      { temperature: 0.75, maxTokens: 700 }
    );

    return NextResponse.json({ letter: content });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
