CREATE TABLE ugc_drafts (
 id text PRIMARY KEY,
 owner uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 data text NOT NULL CHECK(length(data)<=225000 AND jsonb_typeof(data::jsonb)='object'),
 updated bigint NOT NULL
);
CREATE INDEX ugc_drafts_owner ON ugc_drafts(owner,updated DESC);
ALTER TABLE ugc_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ugc_drafts FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON ugc_drafts FROM %I',role_name);
  END IF;
 END LOOP;
END $$;
