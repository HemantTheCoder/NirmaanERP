"use client";

import { useRef, useState } from "react";
import { Mic, Square, Play, RotateCcw, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_DURATION_MS = 3 * 60 * 1000;
const CANDIDATE_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

const LANGUAGE_OPTIONS = [
  { value: "", label: "Auto-detect" },
  { value: "Hindi", label: "Hindi" },
  { value: "Gujarati", label: "Gujarati" },
  { value: "English", label: "English" },
  { value: "a mix of Hindi and English", label: "Mixed (Hindi-English)" },
];

export interface VoiceDprResult {
  transcriptOriginal: string;
  detectedLanguage: string;
  workCompleted: string;
  checklistItems: { description: string; is_completed: boolean }[];
  delaysEncountered: string | null;
}

interface VoiceDprRecorderProps {
  projectId: string;
  onResult: (result: VoiceDprResult) => void;
}

type RecorderState = "idle" | "recording" | "recorded" | "uploading" | "unsupported";

function pickSupportedMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const candidate of CANDIDATE_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return "";
}

export function VoiceDprRecorder({ projectId, onResult }: VoiceDprRecorderProps) {
  const supported =
    typeof window !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const [state, setState] = useState<RecorderState>(supported ? "idle" : "unsupported");
  const [languageHint, setLanguageHint] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cleanupStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        audioBlobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        setState("recorded");
        cleanupStream();
      };

      recorder.start();
      setState("recording");
      stopTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      }, MAX_DURATION_MS);
    } catch {
      setError(
        "Couldn't access the microphone. Check your browser's permission prompt, or that this page is loaded over HTTPS."
      );
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }

  function reRecord() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioBlobRef.current = null;
    setAudioUrl(null);
    setError(null);
    setState("idle");
  }

  async function submitRecording() {
    const blob = audioBlobRef.current;
    if (!blob) return;

    setState("uploading");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("audio", blob, "voice-note.webm");
      formData.append("projectId", projectId);
      if (languageHint) formData.append("languageHint", languageHint);

      const res = await fetch("/api/ai/voice-dpr-draft", { method: "POST", body: formData });
      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(result.error || "Failed to process the voice note.");
        setState("recorded");
        return;
      }

      onResult(result);
      reRecord();
    } catch {
      setError("Failed to reach the AI drafting service.");
      setState("recorded");
    }
  }

  if (state === "unsupported") {
    return (
      <div className="p-3 rounded-xl bg-secondary/30 border border-border text-xs text-muted-foreground flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        Voice recording isn&apos;t available in this browser/context.
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <label className="block text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-indigo-500" />
            Record Voice Update
          </label>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Speak in Hindi, Gujarati, English, or a mix — it drafts the fields below (max 3 min).
          </p>
        </div>
        <select
          value={languageHint}
          onChange={(e) => setLanguageHint(e.target.value)}
          disabled={state === "recording" || state === "uploading"}
          className="px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        {state === "idle" && (
          <button
            type="button"
            onClick={startRecording}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all"
          >
            <Mic className="w-3.5 h-3.5" />
            Start Recording
          </button>
        )}

        {state === "recording" && (
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-all animate-pulse"
          >
            <Square className="w-3.5 h-3.5" />
            Stop Recording
          </button>
        )}

        {(state === "recorded" || state === "uploading") && audioUrl && (
          <div className="flex flex-wrap items-center gap-2 w-full">
            <audio src={audioUrl} controls className="h-8 max-w-[220px]" />
            <button
              type="button"
              onClick={reRecord}
              disabled={state === "uploading"}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-secondary text-foreground transition-all disabled:opacity-60"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Re-record
            </button>
            <button
              type="button"
              onClick={submitRecording}
              disabled={state === "uploading"}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white transition-all"
            >
              {state === "uploading" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {state === "uploading" ? "Drafting…" : "Use This Recording"}
            </button>
          </div>
        )}
      </div>

      {error && <p className={cn("text-[11px] text-rose-500")}>{error}</p>}
    </div>
  );
}
