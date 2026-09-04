"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Loader2, Bot, User as UserIcon, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface ProjectChatPanelProps {
  projectId: string;
  projectName: string;
}

const SUGGESTED_QUESTIONS = [
  "Why is this project behind schedule?",
  "What RFIs are still open?",
  "Summarize progress over the last week",
  "Any recurring delay patterns?",
];

/**
 * "Ask your project" — a chat grounded in this project's own DPRs, delays,
 * RFIs, and punch list (app/api/ai/project-chat). No data leaves this
 * component beyond the question text and a short rolling history; the
 * route re-fetches everything itself through the caller's own
 * session-scoped client, so RLS governs what the model ever sees.
 */
export function ProjectChatPanel({ projectId, projectName }: ProjectChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    const priorHistory = messages.slice(-8);
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/project-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, question: trimmed, history: priorHistory }),
      });
      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(result.error || "Failed to get an answer.");
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", text: result.answer }]);
    } catch {
      setError("Failed to reach the AI assistant.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm flex flex-col h-[32rem]">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Ask {projectName}</h3>
          <p className="text-[11px] text-muted-foreground">
            Grounded in this project&apos;s DPRs, delays, RFIs, and punch list
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-6">
            <Bot className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground max-w-xs">
              Ask a question about this project&apos;s progress, delays, RFIs, or open issues.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-muted border border-border text-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-2.5", m.role === "user" && "flex-row-reverse")}>
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                m.role === "user" ? "bg-primary/10 text-primary" : "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"
              )}
            >
              {m.role === "user" ? <UserIcon className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>
            <div
              className={cn(
                "max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-secondary text-foreground rounded-tl-sm"
              )}
            >
              {m.text}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-secondary text-muted-foreground text-xs flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Thinking…
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-5 mb-2 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-[11px] flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 border-t border-border flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about this project…"
          disabled={isLoading}
          className="flex-1 px-3.5 py-2.5 text-xs bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition-all shrink-0"
          aria-label="Send"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}
