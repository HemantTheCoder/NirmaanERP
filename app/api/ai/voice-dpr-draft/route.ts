import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

// Buffer.from() below requires the Node runtime — the default here, but
// stated explicitly so a future edge-runtime default change can't silently
// break it.
export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    transcriptOriginal: { type: Type.STRING },
    detectedLanguage: { type: Type.STRING },
    workCompleted: { type: Type.STRING },
    checklistItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          is_completed: { type: Type.BOOLEAN },
        },
        required: ["description", "is_completed"],
      },
    },
    delaysEncountered: { type: Type.STRING, nullable: true },
  },
  required: ["transcriptOriginal", "detectedLanguage", "workCompleted", "checklistItems"],
};

/**
 * Transcribes and structures a construction-site voice note (Hindi,
 * Gujarati, English, or code-switched site terminology) directly into DPR
 * fields — one multimodal Gemini call handles both transcription and
 * structuring, no separate speech-to-text service. Never writes to the
 * database itself; the caller reviews/edits the result before saving.
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
    const rateCheck = checkRateLimit(`voice-dpr-draft:${user.id}:${clientIp}`, 8, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: "Too many voice-draft requests. Try again shortly." }, { status: 429 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI drafting isn't configured — add GEMINI_API_KEY to enable this." },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const audio = form.get("audio");
    const projectId = form.get("projectId");
    const languageHint = form.get("languageHint");

    if (!(audio instanceof File) || typeof projectId !== "string") {
      return NextResponse.json({ error: "Missing or invalid request body" }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Voice note is too large (max 15MB)." }, { status: 413 });
    }
    if (audio.size === 0) {
      return NextResponse.json({ error: "Empty recording — nothing to transcribe." }, { status: 400 });
    }

    const arrayBuffer = await audio.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = audio.type || "audio/webm";

    const prompt = `You are transcribing and structuring a construction site voice note into a Daily Progress Report (DPR). The speaker may use Hindi, Gujarati, English, or a code-switched mix of construction-site terminology ("site lingo"). Do not invent details beyond what's actually said.${
      typeof languageHint === "string" && languageHint.trim() ? ` Hint: the speaker likely uses ${languageHint.trim()}.` : ""
    }

Return:
- transcriptOriginal: an accurate transcript in the original spoken language(s)/script
- detectedLanguage: your best guess (e.g. "Hindi", "Gujarati", "English", "Hindi-English mix")
- workCompleted: a 2-4 sentence professional English narrative of completed work today, suitable for a project manager or client
- checklistItems: discrete planned/completed work items mentioned, each with is_completed set based on tone or explicit statement
- delaysEncountered: any delays or bottlenecks mentioned, or null if none`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Audio } }],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const raw = (response.text ?? "").trim();
    if (!raw) {
      return NextResponse.json({ error: "AI transcription came back empty. Try again." }, { status: 502 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "AI response wasn't valid JSON. Try again." }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("voice-dpr-draft error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
