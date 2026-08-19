import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

const WEATHER_LABELS: Record<string, string> = {
  clear: "Clear & Sunny",
  rain: "Rain / Monsoon",
  overcast: "Overcast / Cloudy",
  extreme_heat: "Extreme Heat",
  other: "High Wind / Dust",
};

interface ChecklistInput {
  description: string;
  is_completed: boolean;
}

/**
 * Drafts the DPR's free-text "work completed today" narrative from the
 * structured fields already on the form (checklist, manpower, equipment,
 * weather) — the report author reviews and edits the result before saving;
 * this never writes to the database itself.
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

    const forwardedFor = req.headers.get("x-forwarded-for");
    const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown";
    const rateCheck = checkRateLimit(`ai-dpr-draft:${user.id}:${clientIp}`, 15, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: "Too many draft requests. Try again shortly." }, { status: 429 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI drafting isn't configured — add GEMINI_API_KEY to enable this." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const projectId: unknown = body?.projectId;
    const weather: unknown = body?.weather;
    const manpowerCount: unknown = body?.manpowerCount;
    const equipmentUsed: unknown = body?.equipmentUsed;
    const checklist: unknown = body?.checklist;
    const delaysEncountered: unknown = body?.delaysEncountered;

    if (typeof projectId !== "string" || !Array.isArray(checklist)) {
      return NextResponse.json({ error: "Missing or invalid request body" }, { status: 400 });
    }

    const items = (checklist as ChecklistInput[]).filter(
      (i) => i && typeof i.description === "string" && i.description.trim()
    );

    // The caller's own session-scoped client — if RLS wouldn't let them read
    // this project, the name is simply omitted rather than the whole draft
    // failing over a non-essential detail.
    const { data: project } = await (supabase.from("projects") as any)
      .select("name")
      .eq("id", projectId)
      .single();

    const doneItems = items.filter((i) => i.is_completed).map((i) => i.description);
    const pendingItems = items.filter((i) => !i.is_completed).map((i) => i.description);

    const prompt = `You are drafting the "Work Completed Today" narrative section of a construction Daily Progress Report (DPR). Write 2-4 concise, professional sentences summarizing today's site activity, suitable for a project manager or client to read. Do not invent details beyond what's given below. Do not use markdown formatting — plain prose only.

Project: ${typeof project?.name === "string" ? project.name : "(unspecified)"}
Weather: ${WEATHER_LABELS[weather as string] ?? "Unspecified"}
Manpower on site: ${typeof manpowerCount === "number" || typeof manpowerCount === "string" ? manpowerCount : "unspecified"}
Equipment in use: ${typeof equipmentUsed === "string" && equipmentUsed.trim() ? equipmentUsed : "none listed"}
Planned items completed today: ${doneItems.length ? doneItems.join("; ") : "none"}
Planned items still pending: ${pendingItems.length ? pendingItems.join("; ") : "none"}
${typeof delaysEncountered === "string" && delaysEncountered.trim() ? `Delays noted: ${delaysEncountered.trim()}` : ""}`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const summary = (response.text ?? "").trim();

    if (!summary) {
      return NextResponse.json({ error: "AI draft came back empty. Try again." }, { status: 502 });
    }

    return NextResponse.json({ summary });
  } catch (err: any) {
    console.error("draft-dpr-summary error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
