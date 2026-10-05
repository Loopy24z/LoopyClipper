CREATE TABLE clip_templates (
 id text PRIMARY KEY,
 owner uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 50),
 settings text NOT NULL CHECK (jsonb_typeof(settings::jsonb)='object'),
 updated bigint NOT NULL
);
CREATE UNIQUE INDEX clip_template_owner_name ON clip_templates(owner,lower(name));
ALTER TABLE clip_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON clip_templates FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON clip_templates FROM %I',role_name);
  END IF;
 END LOOP;
END $$;
