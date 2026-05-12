-- Adiciona coluna de foto ao modelo
ALTER TABLE modelo ADD COLUMN IF NOT EXISTS foto_url text;

-- Bucket para fotos de produtos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'produto-fotos',
  'produto-fotos',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas do bucket: somente usuários autenticados podem fazer upload/delete
CREATE POLICY "auth users can upload produto fotos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'produto-fotos');

CREATE POLICY "auth users can update produto fotos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'produto-fotos');

CREATE POLICY "auth users can delete produto fotos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'produto-fotos');

CREATE POLICY "public can read produto fotos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'produto-fotos');
