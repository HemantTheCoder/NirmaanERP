-- =============================================================================
-- Nirmaan ERP — Migration 0029: Dedicated Public Storage Bucket for Punch Photos
-- =============================================================================

-- Ensure dedicated public bucket for punch defect photos exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'punch-photos',
  'punch-photos',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS policies for punch-photos bucket
DROP POLICY IF EXISTS "punch_photos_public_select" ON storage.objects;
DROP POLICY IF EXISTS "punch_photos_authenticated_insert" ON storage.objects;

CREATE POLICY "punch_photos_public_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'punch-photos');

CREATE POLICY "punch_photos_authenticated_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'punch-photos' AND auth.role() = 'authenticated'
  );
