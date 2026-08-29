CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT);
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE
  AS $fn$ SELECT '00000000-0000-4000-8000-000000000001'::uuid $fn$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE
  AS $fn$ SELECT '{}'::jsonb $fn$;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, public BOOLEAN DEFAULT FALSE,
  file_size_limit BIGINT, allowed_mime_types TEXT[]
);
CREATE TABLE storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT REFERENCES storage.buckets(id), name TEXT
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-000000000001', 'dono@local');
