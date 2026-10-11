CREATE TABLE publishing_accounts (
 owner uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 platform text NOT NULL CHECK(platform IN ('youtube','facebook','instagram')),
 remote_id text NOT NULL,
 label text NOT NULL,
 seen bigint NOT NULL,
 PRIMARY KEY(owner,platform)
);
CREATE TABLE publication_jobs (
 id text PRIMARY KEY,
 owner uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 export_id text NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
 platform text NOT NULL CHECK(platform IN ('youtube','facebook','instagram')),
 account_id text NOT NULL,
 account_label text NOT NULL,
 payload text NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','complete','failed','review','cancelled')),
 token text,
 lease bigint NOT NULL DEFAULT 0,
 started integer NOT NULL DEFAULT 0,
 remote_id text,
 error text,
 created bigint NOT NULL,
 updated bigint NOT NULL,
 UNIQUE(export_id,platform)
);
CREATE INDEX publication_queue ON publication_jobs(status,created);
ALTER TABLE publishing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE publication_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON publishing_accounts,publication_jobs FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON publishing_accounts,publication_jobs FROM %I',role_name);
  END IF;
 END LOOP;
END $$;
