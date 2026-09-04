import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    detected: { type: Type.BOOLEAN },
    findings: { type: Type.ARRAY, items: { type: Type.STRING } },
    suggestedTitle: { type: Type.STRING },
    suggestedDescription: { type: Type.STRING },
    suggestedSeverity: { type: Type.STRING, enum: ["minor", "moderate", "major"] },
  },
  required: ["detected", "findings", "suggestedTitle", "suggestedDescription", "suggestedSeverity"],
};

/**
 * Vision QA over a punch-list defect photo — analyzed before it's ever
 * saved (the caller uploads it to Supabase Storage separately, only once
 * the form is actually submitted). Suggests a title/description/severity
 * the author reviews and edits, exactly like the existing AI DPR draft —
 * never creates a punch item itself.
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

    const rateCheck = checkRateLimit(`ai-photo-qa:${user.id}`, 15, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: "Too many analysis requests. Try again shortly." }, { status: 429 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI photo QA isn't configured — add GEMINI_API_KEY to enable this." },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const photo = form.get("photo");

    if (!(photo instanceof File)) {
      return NextResponse.json({ error: "Missing or invalid request body" }, { status: 400 });
    }
    if (photo.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Photo is too large (max 10MB)." }, { status: 413 });
    }
    if (!ALLOWED_TYPES.includes(photo.type)) {
      return NextResponse.json({ error: "Invalid file type. Please upload a JPG, PNG, or WEBP image." }, { status: 400 });
    }

    const arrayBuffer = await photo.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");

    const prompt = `You are a construction site quality/safety inspector reviewing a photo submitted for a punch list (defect tracking) entry. Look for concrete defects (honeycombing, cracks, spalling, misalignment), incomplete or poor-quality work, missing PPE on any visible worker, exposed rebar, or an unsafe condition (unguarded edge, missing barricade, etc).

Only set detected=true if something is actually visible in the photo — do not invent an issue in a photo of routine, acceptable work. If detected, list concrete findings (what you see, described plainly), and draft a suggestedTitle (short, e.g. "Concrete Honeycombing on Column"), suggestedDescription (1-3 sentences, factual), and suggestedSeverity (minor = cosmetic, moderate = rework required, major = structural/safety-critical) suitable to prefill a punch list form — the site engineer will review and edit before submitting.`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }, { inlineData: { mimeType: photo.type, data: base64Image } }],
        },
      ],
      config: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
    });

    const raw = (response.text ?? "").trim();
    if (!raw) {
      return NextResponse.json({ error: "AI analysis came back empty. Try again." }, { status: 502 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "AI response wasn't valid JSON. Try again." }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("photo-qa error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
