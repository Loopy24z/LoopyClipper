CREATE TABLE ugc_plans (
 draft text PRIMARY KEY REFERENCES ugc_drafts(id) ON DELETE CASCADE,
 owner uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 status text NOT NULL CHECK(status IN ('queued','running','complete','failed')),
 brief text NOT NULL CHECK(length(brief)<=5000),
 result text CHECK(length(result)<=16000),
 error text,
 token text,
 lease bigint NOT NULL DEFAULT 0,
 attempts integer NOT NULL DEFAULT 0,
 updated bigint NOT NULL
);
CREATE INDEX ugc_plans_queue ON ugc_plans(status,updated);
ALTER TABLE ugc_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ugc_plans FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON ugc_plans FROM %I',role_name);
  END IF;
 END LOOP;
END $$;
