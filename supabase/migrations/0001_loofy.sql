-- Empty cloud installation. Do not import local demo identities or media implicitly.
-- Run with the database owner; application access is through server-side DATABASE_URL.
CREATE TABLE accounts (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  day text NOT NULL CHECK (day ~ '^\d{4}-\d{2}-\d{2}$'),
  daily_used integer NOT NULL DEFAULT 0 CHECK (daily_used >= 0),
  paid integer NOT NULL DEFAULT 0 CHECK (paid >= 0),
  paid_until bigint NOT NULL DEFAULT 0 CHECK (paid_until >= 0),
  disabled integer NOT NULL DEFAULT 0 CHECK (disabled IN (0,1))
);
CREATE TABLE credit_settings (
  id integer PRIMARY KEY CHECK (id=1),
  daily integer NOT NULL CHECK (daily BETWEEN 0 AND 100000)
);
INSERT INTO credit_settings VALUES (1,10);
CREATE TABLE storage_quota (
  id integer PRIMARY KEY CHECK (id=1),
  reserved_bytes bigint NOT NULL DEFAULT 0 CHECK (reserved_bytes >= 0),
  limit_bytes bigint NOT NULL DEFAULT 5368709120 CHECK (limit_bytes > 0),
  CHECK (reserved_bytes <= limit_bytes)
);
INSERT INTO storage_quota(id) VALUES (1);

CREATE TABLE projects (
  id text PRIMARY KEY,
  owner uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  size bigint NOT NULL CHECK (size BETWEEN 0 AND 2147483648),
  duration double precision NOT NULL CHECK (duration > 0 AND duration <= 3600),
  language text NOT NULL CHECK (language IN ('auto','en','id')),
  youtube text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading','downloading','queued','transcribing','finding highlights','ready','no_speech','failed','deleting')),
  error text,
  upload_id text,
  transcript text NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(transcript::jsonb)='array'),
  created bigint NOT NULL
);
CREATE INDEX projects_owner ON projects(owner);
CREATE TABLE imports (
  id text PRIMARY KEY,
  owner uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  month text NOT NULL,
  seconds double precision NOT NULL CHECK (seconds > 0 AND seconds <= 3600)
);
CREATE INDEX imports_owner_month ON imports(owner,month);
CREATE TABLE clips (
  id text PRIMARY KEY,
  project text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  data text NOT NULL CHECK (jsonb_typeof(data::jsonb)='object'),
  suggested integer NOT NULL DEFAULT 0 CHECK (suggested IN (0,1)),
  created bigint NOT NULL
);
CREATE INDEX clips_project ON clips(project);
CREATE TABLE jobs (
  id text PRIMARY KEY,
  project text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  clip text REFERENCES clips(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('transcribe','export')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','complete','failed')),
  payload text NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(payload::jsonb)='object'),
  token text,
  lease bigint NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  error text,
  size bigint NOT NULL DEFAULT 0 CHECK (size BETWEEN 0 AND 1073741824),
  created bigint NOT NULL
);
CREATE INDEX jobs_status_lease ON jobs(status,lease);
CREATE INDEX jobs_project ON jobs(project);
CREATE UNIQUE INDEX one_active_export ON jobs(clip) WHERE kind='export' AND status IN ('queued','running');
CREATE TABLE service_state (id text PRIMARY KEY, seen bigint NOT NULL);
CREATE TABLE events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  value double precision,
  created bigint NOT NULL
);
CREATE INDEX events_owner_created ON events(owner,created);
CREATE TABLE credit_ledger (
  project text PRIMARY KEY,
  owner uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  day text NOT NULL,
  free integer NOT NULL CHECK (free >= 0),
  paid integer NOT NULL CHECK (paid >= 0),
  refunded integer NOT NULL DEFAULT 0 CHECK (refunded IN (0,1)),
  created bigint NOT NULL,
  paid_until bigint NOT NULL DEFAULT 0
);
CREATE INDEX credit_owner ON credit_ledger(owner,created);
CREATE TABLE plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  credits integer NOT NULL CHECK (credits BETWEEN 1 AND 100000),
  days integer NOT NULL CHECK (days BETWEEN 1 AND 365),
  price text NOT NULL,
  active integer NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);
INSERT INTO plans VALUES ('creator','Creator',120,30,'Contact admin',1);
CREATE TABLE subscriptions (
  id text PRIMARY KEY,
  owner uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  plan text NOT NULL REFERENCES plans(id),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','active','cancelled')),
  created bigint NOT NULL,
  expires bigint,
  reference text,
  CHECK (status <> 'active' OR (expires IS NOT NULL AND reference IS NOT NULL AND length(trim(reference)) > 0))
);
CREATE UNIQUE INDEX one_pending_subscription ON subscriptions(owner) WHERE status='requested';
CREATE TABLE admin_audit (
  id text PRIMARY KEY,
  actor uuid NOT NULL,
  target text NOT NULL,
  action text NOT NULL,
  detail text NOT NULL,
  created bigint NOT NULL
);

CREATE FUNCTION debit_credit() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE
  a accounts%ROWTYPE;
  today text := to_char(now() AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD');
  now_ms bigint := (extract(epoch FROM now())*1000)::bigint;
  allowance integer;
  cost integer := NEW.free + NEW.paid;
BEGIN
  IF cost < 1 OR cost > 60 OR NEW.free < 0 OR NEW.paid < 0 OR NEW.refunded <> 0 THEN
    RAISE EXCEPTION 'Invalid credit charge' USING ERRCODE='23514';
  END IF;
  SELECT * INTO a FROM accounts WHERE id=NEW.owner FOR UPDATE;
  IF NOT FOUND OR a.disabled <> 0 THEN
    RAISE EXCEPTION 'Account missing or disabled' USING ERRCODE='23514';
  END IF;
  SELECT daily INTO allowance FROM credit_settings WHERE id=1 FOR SHARE;
  IF a.day <> today THEN a.daily_used := 0; END IF;
  IF a.paid_until <= now_ms THEN a.paid := 0; a.paid_until := 0; END IF;
  NEW.day := today;
  NEW.free := LEAST(cost,GREATEST(0,allowance-a.daily_used));
  NEW.paid := cost-NEW.free;
  NEW.paid_until := a.paid_until;
  IF NEW.paid > a.paid THEN
    RAISE EXCEPTION 'Insufficient credits' USING ERRCODE='23514';
  END IF;
  UPDATE accounts SET day=today,daily_used=a.daily_used+NEW.free,paid=a.paid-NEW.paid,paid_until=a.paid_until WHERE id=NEW.owner;
  RETURN NEW;
END $$;
CREATE TRIGGER debit_credit BEFORE INSERT ON credit_ledger FOR EACH ROW EXECUTE FUNCTION debit_credit();

CREATE FUNCTION refund_credit() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE now_ms bigint := (extract(epoch FROM now())*1000)::bigint;
BEGIN
  IF OLD.refunded=0 AND NEW.refunded=1 THEN
    -- UPDATE locks the account; only credit from its original unexpired grant is restored.
    UPDATE accounts SET
      daily_used=GREATEST(0,daily_used-CASE WHEN day=NEW.day THEN NEW.free ELSE 0 END),
      paid=paid+CASE WHEN NEW.paid_until>now_ms AND paid_until>now_ms THEN NEW.paid ELSE 0 END
    WHERE id=NEW.owner;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER refund_credit AFTER UPDATE OF refunded ON credit_ledger FOR EACH ROW EXECUTE FUNCTION refund_credit();

CREATE FUNCTION activate_subscription() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE
  credits_to_add integer;
  now_ms bigint := (extract(epoch FROM now())*1000)::bigint;
BEGIN
  IF OLD.status='requested' AND NEW.status='active' THEN
    IF NEW.expires <= now_ms THEN RAISE EXCEPTION 'Subscription expiry must be in the future' USING ERRCODE='23514'; END IF;
    SELECT credits INTO credits_to_add FROM plans WHERE id=NEW.plan;
    UPDATE accounts SET paid=CASE WHEN paid_until>now_ms THEN paid ELSE 0 END+credits_to_add,
      paid_until=GREATEST(paid_until,NEW.expires) WHERE id=NEW.owner AND disabled=0;
    IF NOT FOUND THEN RAISE EXCEPTION 'Account missing or disabled' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER activate_subscription AFTER UPDATE OF status ON subscriptions FOR EACH ROW EXECUTE FUNCTION activate_subscription();

CREATE FUNCTION reserve_storage() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE old_bytes bigint := 0; new_bytes bigint := 0; delta bigint;
BEGIN
  IF TG_TABLE_NAME='projects' THEN
    IF TG_OP <> 'INSERT' THEN old_bytes := OLD.size; END IF;
    IF TG_OP <> 'DELETE' THEN new_bytes := NEW.size; END IF;
  ELSE
    IF TG_OP <> 'INSERT' AND OLD.kind='export' AND OLD.status IN ('queued','running','complete','failed') THEN old_bytes := OLD.size; END IF;
    IF TG_OP <> 'DELETE' AND NEW.kind='export' AND NEW.status IN ('queued','running','complete','failed') THEN new_bytes := NEW.size; END IF;
  END IF;
  delta := new_bytes-old_bytes;
  IF delta <> 0 THEN
    -- A single atomic row update serializes storage reservations across all accounts.
    UPDATE storage_quota SET reserved_bytes=reserved_bytes+delta WHERE id=1 AND reserved_bytes+delta BETWEEN 0 AND limit_bytes;
    IF NOT FOUND THEN RAISE EXCEPTION 'Storage quota exceeded' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER reserve_project_storage AFTER INSERT OR UPDATE OR DELETE ON projects FOR EACH ROW EXECUTE FUNCTION reserve_storage();
CREATE TRIGGER reserve_export_storage AFTER INSERT OR UPDATE OR DELETE ON jobs FOR EACH ROW EXECUTE FUNCTION reserve_storage();

-- No browser policies: all data access goes through authenticated server endpoints.
DO $$
DECLARE table_name text; role_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['accounts','credit_settings','storage_quota','projects','imports','clips','jobs','service_state','events','credit_ledger','plans','subscriptions','admin_audit'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',table_name);
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',table_name,role_name);
      END IF;
    END LOOP;
  END LOOP;
END $$;
REVOKE ALL ON SEQUENCE events_id_seq FROM PUBLIC;
REVOKE ALL ON FUNCTION debit_credit(),refund_credit(),activate_subscription(),reserve_storage() FROM PUBLIC;
