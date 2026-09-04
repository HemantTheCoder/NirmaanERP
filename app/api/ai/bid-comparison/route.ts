import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getTenderById } from "@/lib/queries/tenders";

const MIN_BIDS_TO_COMPARE = 2;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    recommendation: { type: Type.STRING },
    rankedBids: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          bidId: { type: Type.STRING },
          rank: { type: Type.NUMBER },
          pricePositioning: { type: Type.STRING },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          risks: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["bidId", "rank", "pricePositioning", "strengths", "risks"],
      },
    },
  },
  required: ["recommendation", "rankedBids"],
};

/**
 * Compares every bid submitted on a tender — bids here are structured
 * (amount, EMD reference, terms_accepted) plus a free-text proposal, not
 * uploaded PDFs, so this reads that data directly rather than doing any
 * document extraction. Staff-only (mirrors the bids-review RLS/UI gate):
 * a contractor should never see how their bid stacks up against a rival's.
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
      return NextResponse.json({ error: "Forbidden: staff access required" }, { status: 403 });
    }

    const rateCheck = checkRateLimit(`ai-bid-comparison:${user.id}`, 10, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: "Too many comparison requests. Try again shortly." }, { status: 429 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI comparison isn't configured — add GEMINI_API_KEY to enable this." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const tenderId: unknown = body?.tenderId;
    if (typeof tenderId !== "string") {
      return NextResponse.json({ error: "Missing or invalid request body" }, { status: 400 });
    }

    const { tender, bids } = await getTenderById(supabase, tenderId, user.id, profile.role);
    if (!tender) {
      return NextResponse.json({ error: "Tender not found or not accessible." }, { status: 404 });
    }
    if (bids.length < MIN_BIDS_TO_COMPARE) {
      return NextResponse.json(
        { error: `Need at least ${MIN_BIDS_TO_COMPARE} bids to compare — this tender has ${bids.length}.` },
        { status: 400 }
      );
    }

    const listing = bids
      .map(
        (b) => `Bid ID: ${b.id}
Contractor: ${b.contractor?.full_name || "Unknown"}
Bid Amount: ₹${b.bid_amount.toLocaleString("en-IN")}
EMD Reference: ${b.emd_reference || "NOT PROVIDED"}
Terms Accepted: ${b.terms_accepted ? "Yes" : "NOT ACCEPTED"}
Current Status: ${b.status}
Proposal: ${(b.proposal_text || "(no proposal text submitted)").slice(0, 1500)}
---`
      )
      .join("\n");

    const prompt = `You are helping a construction project manager compare competing bids on a trade tender ("${tender.title}", category: ${tender.category}). Estimated value range: ${tender.estimated_value_min ? `₹${tender.estimated_value_min.toLocaleString("en-IN")}` : "n/a"} to ${tender.estimated_value_max ? `₹${tender.estimated_value_max.toLocaleString("en-IN")}` : "n/a"}.

For each bid below, base your assessment ONLY on what's actually written — do not invent qualifications or experience the proposal doesn't mention. A missing EMD reference or unaccepted terms is a real risk factor, not a minor detail. Rank the bids (1 = best overall value, considering price AND the proposal's substance/risk, not price alone), and for each give 1-3 concrete strengths and 1-3 concrete risks (empty arrays are fine if none). Then write a 2-4 sentence overall recommendation citing specific bid amounts/contractors.

Return each bid's bidId exactly as given below — do not alter it.

${listing}`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
    });

    const raw = (response.text ?? "").trim();
    if (!raw) {
      return NextResponse.json({ error: "AI comparison came back empty. Try again." }, { status: 502 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "AI response wasn't valid JSON. Try again." }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("bid-comparison error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
