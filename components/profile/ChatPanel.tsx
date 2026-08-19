"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Send, Loader2, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getThread, sendMessage, markThreadRead, type Message } from "@/lib/queries/messages";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  otherUser: { id: string; full_name: string | null };
}

export function ChatPanel({ isOpen, onClose, currentUserId, otherUser }: ChatPanelProps) {
  const supabase = createClient();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const loadThread = useCallback(async () => {
    setIsLoading(true);
    try {
      const thread = await getThread(supabase, currentUserId, otherUser.id);
      setMessages(thread);
      await markThreadRead(supabase, currentUserId, otherUser.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversation.");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, currentUserId, otherUser.id]);

  // Load the thread and open a Realtime subscription for incoming messages
  // whenever the panel opens. Only subscribes to rows where the current user
  // is the recipient (Realtime's filter syntax doesn't support the OR needed
  // for "either direction of this pair" in one subscription) — messages this
  // user sends are appended locally right after sendMessage() succeeds, and
  // the sender_id check below discards incoming rows from anyone else, since
  // the recipient-only filter still catches every other conversation this
  // user is in.
  useEffect(() => {
    if (!isOpen) return;

    loadThread();

    const channel = supabase
      .channel(`messages:${currentUserId}:${otherUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        (payload) => {
          const incoming = payload.new as Message;
          if (incoming.sender_id !== otherUser.id) return; // a different conversation

          setMessages((prev) => [...prev, incoming]);
          markThreadRead(supabase, currentUserId, otherUser.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, supabase, currentUserId, otherUser.id, loadThread]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || isSending) return;

    setIsSending(true);
    setError(null);

    const res = await sendMessage(supabase, currentUserId, otherUser.id, body);

    setIsSending(false);

    if (!res.success || !res.data) {
      setError(res.error || "Failed to send message.");
      return;
    }

    setMessages((prev) => [...prev, res.data!]);
    setDraft("");
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border w-full sm:max-w-md h-[80vh] sm:h-[600px] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-500" />
            {otherUser.full_name || "Conversation"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground text-center px-6">
              No messages yet. Say hello to {otherUser.full_name || "them"}.
            </div>
          ) : (
            messages.map((m) => {
              const isMine = m.sender_id === currentUserId;
              return (
                <div key={m.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[75%] px-3.5 py-2 rounded-2xl text-sm break-words",
                      isMine
                        ? "bg-indigo-600 text-white rounded-br-sm"
                        : "bg-secondary text-foreground rounded-bl-sm"
                    )}
                  >
                    {m.body}
                    <p className={cn("text-[10px] mt-1", isMine ? "text-indigo-100/80" : "text-muted-foreground")}>
                      {new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {error && (
          <div className="px-4 pb-2 text-xs text-rose-600 dark:text-rose-400">{error}</div>
        )}

        <form onSubmit={handleSend} className="flex items-center gap-2 p-3 border-t border-border shrink-0">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3.5 py-2.5 text-sm bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={isSending || !draft.trim()}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors shrink-0"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
