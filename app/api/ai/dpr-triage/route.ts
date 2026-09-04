import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    delayFlag: {
      type: Type.OBJECT,
      properties: {
        detected: { type: Type.BOOLEAN },
        reason: { type: Type.STRING },
        draftText: { type: Type.STRING },
      },
      required: ["detected", "reason", "draftText"],
    },
    safetyFlag: {
      type: Type.OBJECT,
      properties: {
        detected: { type: Type.BOOLEAN },
        reason: { type: Type.STRING },
        draftText: { type: Type.STRING },
        severity: { type: Type.STRING, enum: ["minor", "moderate", "major"] },
      },
      required: ["detected", "reason", "draftText", "severity"],
    },
  },
  required: ["delayFlag", "safetyFlag"],
};

/**
 * Passive-to-active alerting over a just-submitted DPR: reads the free-text
 * "work completed" and "delays encountered" fields for a schedule-delay or
 * safety-incident signal the site staff mentioned in passing but didn't log
 * as a formal record. Only ever returns a suggestion + draft text — this
 * route never writes to project_delays or safety_incidents itself; the
 * caller decides whether to act on it.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const rateCheck = checkRateLimit(`ai-dpr-triage:${user.id}`, 15, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: "Too many triage requests. Try again shortly." }, { status: 429 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI triage isn't configured — add GEMINI_API_KEY to enable this." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const projectId: unknown = body?.projectId;
    const workCompleted: unknown = body?.workCompleted;
    const delaysEncountered: unknown = body?.delaysEncountered;

    if (typeof projectId !== "string") {
      return NextResponse.json({ error: "Missing or invalid request body" }, { status: 400 });
    }

    const workText = typeof workCompleted === "string" ? workCompleted.trim() : "";
    const delayText = typeof delaysEncountered === "string" ? delaysEncountered.trim() : "";

    if (workText.length < 15 && delayText.length < 5) {
      return NextResponse.json({
        delayFlag: { detected: false, reason: "", draftText: "" },
        safetyFlag: { detected: false, reason: "", draftText: "" },
      });
    }

    const prompt = `You are triaging a construction site's Daily Progress Report (DPR) for two things a project manager should be alerted to immediately, not just have logged as passive text:

1. A schedule-delay-worthy issue (material shortage, equipment breakdown, weather stoppage, approval/permit wait, subcontractor no-show, etc.) mentioned anywhere in the text below — even in passing — that isn't just a routine progress note.
2. A safety-worthy issue (injury, near-miss, hazard, PPE violation, unsafe condition) mentioned anywhere in the text below.

Only flag something as detected if it's genuinely there — do not invent an issue from routine, on-track progress notes. If detected, write a short, factual draftText (1-2 sentences) suitable to prefill a formal delay report or safety incident report, in the report author's voice, based only on what's stated.

"Work Completed Today" field:
${workText || "(empty)"}

"Delays / Bottlenecks Encountered" field:
${delayText || "(empty)"}`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
    });

    const raw = (response.text ?? "").trim();
    if (!raw) {
      return NextResponse.json({ error: "AI triage came back empty. Try again." }, { status: 502 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "AI response wasn't valid JSON. Try again." }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("dpr-triage error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
