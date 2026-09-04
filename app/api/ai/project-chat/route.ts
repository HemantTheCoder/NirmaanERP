import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getProjectById } from "@/lib/queries/projects";
import { getProjectDprHistory } from "@/lib/queries/dpr";
import { getDelayHistory } from "@/lib/queries/delays";
import { getProjectRfis } from "@/lib/queries/rfis";
import { getProjectPunchItems } from "@/lib/queries/punch_list";

const MAX_DPR_ENTRIES = 25;
const MAX_RFIS = 40;
const MAX_PUNCH_ITEMS = 40;
const MAX_HISTORY_TURNS = 8;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    answer: { type: Type.STRING },
  },
  required: ["answer"],
};

interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

/**
 * "Ask your project" — answers a question grounded in this project's own
 * DPRs, delays, RFIs, and punch list, all fetched through the caller's own
 * session-scoped client so RLS governs exactly what data reaches the
 * prompt (a client user only ever sees their linked project's rows to
 * begin with). No vector store — the whole project's recent record set is
 * small enough to hand to the model directly, same as the safety-patterns
 * route already does for incident logs.
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

    const rateCheck = checkRateLimit(`ai-project-chat:${user.id}`, 20, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: "Too many questions. Try again shortly." }, { status: 429 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI chat isn't configured — add GEMINI_API_KEY to enable this." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const projectId: unknown = body?.projectId;
    const question: unknown = body?.question;
    const history: unknown = body?.history;

    if (typeof projectId !== "string" || typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "Missing or invalid request body" }, { status: 400 });
    }

    // Session-scoped client — if RLS wouldn't let this user see the
    // project at all, getProjectById returns null and the request is
    // refused before any project data is ever gathered.
    const projectData = await getProjectById(supabase, projectId);
    if (!projectData) {
      return NextResponse.json({ error: "Project not found or not accessible." }, { status: 404 });
    }

    const [dprHistory, delayHistory, rfis, punchItems] = await Promise.all([
      getProjectDprHistory(supabase, projectId),
      getDelayHistory(supabase, projectId),
      getProjectRfis(supabase, projectId),
      getProjectPunchItems(supabase, projectId),
    ]);

    const dprLines = dprHistory
      .slice(0, MAX_DPR_ENTRIES)
      .map((d) => {
        const ppc = d.ppc_percentage != null ? `${d.ppc_percentage}%` : "n/a";
        const work = (d.work_completed || "").slice(0, 200);
        const delay = d.delays_encountered ? ` | Delay noted: ${d.delays_encountered.slice(0, 150)}` : "";
        return `- [${d.report_date}] Weather: ${d.weather}, Manpower: ${d.manpower_count}, PPC: ${ppc}. Work: ${work}${delay}`;
      })
      .join("\n");

    const delayLines = delayHistory
      .map((d) => {
        const status = d.status === "open" ? "OPEN" : `rectified after ${d.days_to_rectify ?? "?"}d`;
        return `- [${d.reported_date}] (${status}) ${d.reason}${d.rectification_notes ? ` — Resolution: ${d.rectification_notes}` : ""}`;
      })
      .join("\n");

    const rfiLines = rfis
      .slice(0, MAX_RFIS)
      .map((r) => `- ${r.rfi_number} [${r.status}] "${r.subject}"${r.due_date ? ` (due ${r.due_date})` : ""}${r.response ? ` — Answered: ${r.response.slice(0, 150)}` : ""}`)
      .join("\n");

    const openMajorPunchItems = punchItems
      .filter((p) => p.status !== "verified" && (p.severity === "major" || p.status === "open"))
      .slice(0, MAX_PUNCH_ITEMS)
      .map((p) => `- [${p.severity}/${p.status}] ${p.title} (${p.location_detail})`)
      .join("\n");

    const context = `Project: ${projectData.project.name} (status: ${projectData.project.status}, ${projectData.project.start_date ?? "?"} to ${projectData.project.end_date ?? "?"})

Daily Progress Reports (most recent ${Math.min(dprHistory.length, MAX_DPR_ENTRIES)} of ${dprHistory.length}):
${dprLines || "(none logged yet)"}

Delay log (${delayHistory.length} total):
${delayLines || "(no delays logged)"}

RFIs (${rfis.length} total, showing up to ${MAX_RFIS}):
${rfiLines || "(none)"}

Open / major punch list items (showing up to ${MAX_PUNCH_ITEMS}):
${openMajorPunchItems || "(none open)"}`;

    const historyTurns: ChatTurn[] = Array.isArray(history)
      ? history
          .filter((h: any) => h && (h.role === "user" || h.role === "assistant") && typeof h.text === "string")
          .slice(-MAX_HISTORY_TURNS)
      : [];

    const historyText = historyTurns.length
      ? "\n\nPrior conversation this session:\n" +
        historyTurns.map((h) => `${h.role === "user" ? "Q" : "A"}: ${h.text}`).join("\n")
      : "";

    const prompt = `You are answering a question about a specific construction project, grounded only in the project data below — do not invent facts, dates, or numbers that aren't in it. If the data doesn't contain enough to answer confidently, say so plainly rather than guessing. Cite specific dates, RFI numbers, or figures from the data when relevant. Keep the answer concise (2-6 sentences unless the question needs a list).

${context}${historyText}

Question: ${question.trim()}`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
    });

    const raw = (response.text ?? "").trim();
    if (!raw) {
      return NextResponse.json({ error: "AI came back empty. Try again." }, { status: 502 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "AI response wasn't valid JSON. Try again." }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("project-chat error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
