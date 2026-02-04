-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents', 
  'documents', 
  true,
  10485760, -- 10MB limit
  ARRAY['application/pdf']::text[]
);

-- Policy to allow public read access
CREATE POLICY "Public read access for documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents');

-- Policy to allow anyone to upload (since no auth)
CREATE POLICY "Anyone can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents');

-- Policy to allow anyone to delete their uploads
CREATE POLICY "Anyone can delete documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'documents');