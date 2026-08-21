import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSafetyIncidents } from "@/lib/queries/safety";

const MIN_INCIDENTS_FOR_PATTERNS = 5;
const MAX_INCIDENTS_IN_PROMPT = 100;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    narrative: { type: Type.STRING },
    patterns: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          theme: { type: Type.STRING },
          severity: { type: Type.STRING, enum: ["low", "medium", "high"] },
          evidenceCount: { type: Type.NUMBER },
          exampleIncidents: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["theme", "severity", "evidenceCount", "exampleIncidents"],
      },
    },
  },
  required: ["narrative", "patterns"],
};

/**
 * On-demand pattern detection over safety incident/near-miss history.
 * `location_detail` is free text, not a structured field, so surfacing
 * clusters ("recurring near-misses in one crane zone") needs an LLM pass
 * over the actual descriptions rather than a GROUP BY. Manager-only —
 * this is a cross-user aggregate view, not gated solely by the
 * individual-incident RLS a regular user already operates under.
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

    const { data: profile } = await (supabase.from("users") as any)
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin" && profile?.role !== "project_manager") {
      return NextResponse.json({ error: "Forbidden: manager access required" }, { status: 403 });
    }

    const rateCheck = checkRateLimit(`ai-safety-patterns:${user.id}`, 10, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: "Too many pattern requests. Try again shortly." }, { status: 429 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI pattern detection isn't configured — add GEMINI_API_KEY to enable this." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const projectId: unknown = body?.projectId;

    let incidents = await getSafetyIncidents(supabase, { userId: user.id, isManager: true });

    if (typeof projectId === "string" && projectId) {
      incidents = incidents.filter((i) => i.project_id === projectId);
    }

    if (incidents.length < MIN_INCIDENTS_FOR_PATTERNS) {
      return NextResponse.json({
        narrative: "Not enough incidents recorded yet to detect meaningful patterns.",
        patterns: [],
      });
    }

    const recent = incidents.slice(0, MAX_INCIDENTS_IN_PROMPT);

    const listing = recent
      .map((i) => {
        const d = new Date(i.created_at);
        const dayName = DAY_NAMES[d.getUTCDay()];
        const dateStr = d.toISOString().slice(0, 10);
        return `- [${dateStr}, ${dayName}] (${i.incident_type}, ${i.severity} severity) "${i.title}" — Location: ${i.location_detail}. Project: ${i.project_name ?? "unspecified"}.`;
      })
      .join("\n");

    const prompt = `You are analyzing a construction site's safety incident and near-miss log to find recurring patterns — the kind a safety manager would want flagged before they repeat, not just reviewed one at a time. Look for clustering by day-of-week, time period, location/zone (locations are free text and may be phrased inconsistently — e.g. "Level 5", "5th Floor", and "Floor 5 East Wing" likely refer to the same zone; use judgment to group these), incident type, or escalating severity in one area over time. Only report patterns actually supported by the data below — do not invent a pattern from unrelated incidents just to fill a quota. If there are genuinely no real patterns, return an empty patterns array and say so plainly in the narrative.

Incident log (${recent.length} most recent):
${listing}

Return a short overall narrative (2-4 sentences) plus a list of concrete patterns, each citing which incidents (by title) support it.`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const raw = (response.text ?? "").trim();
    if (!raw) {
      return NextResponse.json({ error: "AI pattern analysis came back empty. Try again." }, { status: 502 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "AI response wasn't valid JSON. Try again." }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("safety-patterns error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
