import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

// Two Files-API uploads + polling + a multimodal call, serially — longer
// than the fast single-call existing AI routes, hence the explicit bump.
export const runtime = "nodejs";
export const maxDuration = 60;

const DIFF_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"];

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    changeType: { type: Type.STRING, enum: ["minor", "major", "unknown"] },
  },
  required: ["summary", "changeType"],
};

function extensionOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

async function uploadAndWaitActive(ai: GoogleGenAI, buffer: Buffer, mimeType: string, displayName: string) {
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
  let file = await ai.files.upload({ file: blob, config: { mimeType, displayName } });
  for (let i = 0; i < 20 && file.state === "PROCESSING"; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    file = await ai.files.get({ name: file.name! });
  }
  if (file.state !== "ACTIVE") {
    throw new Error(`File "${displayName}" failed to process (state: ${file.state})`);
  }
  return file;
}

/**
 * Compares a newly-uploaded document against the version it supersedes,
 * using Gemini's Files API (not inlineData — two ~10MB documents
 * base64-inflate to ~26.6MB combined, over the inline-request ceiling).
 * Never blocks the upload itself; the caller has already saved the new
 * document by the time this runs — this only writes diff_status/
 * diff_summary back onto that row.
 */
export async function POST(req: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const rateCheck = checkRateLimit(`ai-document-diff:${user.id}`, 10, 15 * 60 * 1000);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: "Too many diff requests. Try again shortly." }, { status: 429 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI diffing isn't configured — add GEMINI_API_KEY to enable this." },
      { status: 500 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  const documentId = form.get("documentId");
  const supersedesDocumentId = form.get("supersedesDocumentId");

  if (!(file instanceof File) || typeof documentId !== "string" || typeof supersedesDocumentId !== "string") {
    return NextResponse.json({ error: "Missing or invalid request body" }, { status: 400 });
  }

  if (!DIFF_EXTENSIONS.includes(extensionOf(file.name))) {
    return NextResponse.json({ skipped: true, reason: "File type not eligible for AI diffing." });
  }

  // Fetch both rows through the caller's own session-scoped client — RLS
  // already governs what they're allowed to see (e.g. a client blocked
  // from a 'contract' document can't diff it either).
  const { data: newDoc } = await (supabase.from("project_documents") as any)
    .select("*")
    .eq("id", documentId)
    .single();
  const { data: priorDoc } = await (supabase.from("project_documents") as any)
    .select("*")
    .eq("id", supersedesDocumentId)
    .single();

  if (!newDoc || !priorDoc || newDoc.project_id !== priorDoc.project_id) {
    return NextResponse.json(
      { error: "Prior document not found, or belongs to a different project." },
      { status: 400 }
    );
  }

  if (!DIFF_EXTENSIONS.includes(extensionOf(priorDoc.file_name))) {
    return NextResponse.json({ skipped: true, reason: "Prior document's file type isn't eligible for AI diffing." });
  }

  // Mark pending immediately so a mid-flight page refresh shows "comparing".
  await (supabase.from("project_documents") as any)
    .update({ diff_status: "pending" })
    .eq("id", documentId);

  try {
    const { data: priorBlob, error: dlErr } = await supabase.storage
      .from("project-documents")
      .download(priorDoc.file_path);

    if (dlErr || !priorBlob) {
      throw new Error(dlErr?.message || "Failed to download prior document");
    }

    const newBuffer = Buffer.from(await file.arrayBuffer());
    const priorBuffer = Buffer.from(await priorBlob.arrayBuffer());

    const ai = new GoogleGenAI({ apiKey });
    const [priorFile, newFile] = await Promise.all([
      uploadAndWaitActive(ai, priorBuffer, priorDoc.file_type || "application/pdf", priorDoc.file_name),
      uploadAndWaitActive(ai, newBuffer, file.type || "application/pdf", file.name),
    ]);

    const prompt = `Compare these two versions of the same construction project document ("${priorDoc.file_name}" then "${newDoc.file_name}"). Summarize concretely what changed — added/removed/modified content, revised dimensions or clauses, etc. — in 2-4 sentences. If nothing meaningful changed, say so plainly.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { fileData: { fileUri: priorFile.uri, mimeType: priorFile.mimeType } },
            { fileData: { fileUri: newFile.uri, mimeType: newFile.mimeType } },
          ],
        },
      ],
      config: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
    });

    const raw = (response.text ?? "").trim();
    if (!raw) throw new Error("AI diff came back empty.");

    const parsed = JSON.parse(raw);
    const summary: string = parsed.summary;
    if (!summary) throw new Error("AI diff came back empty.");

    await (supabase.from("project_documents") as any)
      .update({ diff_status: "complete", diff_summary: summary })
      .eq("id", documentId);

    ai.files.delete({ name: priorFile.name! }).catch(() => {});
    ai.files.delete({ name: newFile.name! }).catch(() => {});

    return NextResponse.json({ summary, changeType: parsed.changeType });
  } catch (err: any) {
    console.error("document-diff error:", err);
    await (supabase.from("project_documents") as any)
      .update({ diff_status: "failed" })
      .eq("id", documentId);
    return NextResponse.json({ error: err.message || "Diff generation failed" }, { status: 502 });
  }
}
