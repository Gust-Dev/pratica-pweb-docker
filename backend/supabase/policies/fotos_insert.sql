-- Habilita RLS explicitamente (por padrão o storage.objects já utiliza RLS).
ALTER TABLE storage.objects
  ENABLE ROW LEVEL SECURITY;

-- Remove política prévia com mesmo nome, caso exista, para facilitar reaplicações.
DROP POLICY IF EXISTS "allow authenticated uploads to fotos" ON storage.objects;

-- Permite INSERT apenas para usuários autenticados, garantindo que escrevam no próprio diretório.
CREATE POLICY "allow authenticated uploads to fotos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fotos'
  AND auth.uid()::text = split_part(name, '/', 2)
);
