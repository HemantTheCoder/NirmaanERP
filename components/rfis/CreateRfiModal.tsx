"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createRfi } from "@/lib/queries/rfis";
import type { TaskPriority } from "@/lib/queries/tasks";

interface CreateRfiModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  projects: { id: string; name: string }[];
  teamMembers: { id: string; full_name: string }[];
  onCreated: () => void;
}

export function CreateRfiModal({ isOpen, onClose, userId, projects, teamMembers, onCreated }: CreateRfiModalProps) {
  const supabase = createClient();
  const [projectId, setProjectId] = useState("");
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function resetAndClose() {
    setProjectId("");
    setSubject("");
    setQuestion("");
    setPriority("medium");
    setAssignedTo("");
    setDueDate("");
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const { error: createError } = await createRfi(supabase, {
      project_id: projectId,
      subject,
      question,
      priority,
      assigned_to: assignedTo || undefined,
      due_date: dueDate || undefined,
      raised_by: userId,
    });

    if (createError) {
      setError(createError.message);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    onCreated();
    resetAndClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-bold text-foreground">New Request for Information</h2>
          <button onClick={resetAndClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Project</label>
            <select
              required
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Subject</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Clarification on beam reinforcement detail"
              className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Question</label>
            <textarea
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              placeholder="Describe the information needed in detail..."
              className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Assign to (optional)</label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={resetAndClose}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white transition-colors"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit RFI
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
