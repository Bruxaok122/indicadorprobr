-- Ensure the documents bucket allows all audio MIME types
UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'documents';
