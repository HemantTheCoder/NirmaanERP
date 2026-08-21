-- Voice-to-DPR: keep the original-language transcript alongside the
-- structured English DPR fields it was drafted from, for audit-trail
-- value — a client or PM who doesn't read Hindi/Gujarati can still trust
-- what was said, since it's right there in the source language too.

ALTER TABLE public.daily_progress_reports
  ADD COLUMN IF NOT EXISTS voice_transcript_original TEXT NULL,
  ADD COLUMN IF NOT EXISTS voice_transcript_language TEXT NULL;

NOTIFY pgrst, 'reload schema';
