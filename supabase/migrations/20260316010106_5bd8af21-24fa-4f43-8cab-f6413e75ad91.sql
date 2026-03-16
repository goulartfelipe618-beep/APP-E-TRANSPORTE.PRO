
-- Create storage bucket for template images
INSERT INTO storage.buckets (id, name, public)
VALUES ('templates', 'templates', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to templates bucket
CREATE POLICY "Authenticated users can upload template images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'templates');

-- Allow authenticated users to update template images
CREATE POLICY "Authenticated users can update template images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'templates');

-- Allow authenticated users to delete template images
CREATE POLICY "Authenticated users can delete template images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'templates');

-- Allow public read access to template images
CREATE POLICY "Public can view template images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'templates');
