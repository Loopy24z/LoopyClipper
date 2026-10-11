CREATE TABLE audio_imports (
 id text PRIMARY KEY,
 owner uuid NOT NULL REFERENCES accounts(id),
 url text NOT NULL,
 status text NOT NULL CHECK(status IN ('queued','running','complete','failed','cancelled')),
 name text NOT NULL DEFAULT 'Imported audio',
 error text,
 token text,
 lease bigint NOT NULL DEFAULT 0,
 size bigint NOT NULL DEFAULT 0,
 created bigint NOT NULL,
 expires bigint NOT NULL
);
CREATE INDEX audio_imports_queue ON audio_imports(status,created);
ALTER TABLE audio_imports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON audio_imports FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON audio_imports FROM %I',r); END IF;
END LOOP; END $$;
-- Reserve the maximum temporary object size even while queued/cancelled. Release
-- only after worker cleanup deletes the object and row, including late uploads.
CREATE FUNCTION reserve_audio_import_storage() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE delta bigint;
BEGIN
 delta := CASE WHEN TG_OP='INSERT' THEN 26214400 ELSE -26214400 END;
 UPDATE storage_quota SET reserved_bytes=reserved_bytes+delta WHERE id=1 AND reserved_bytes+delta BETWEEN 0 AND limit_bytes;
 IF NOT FOUND THEN RAISE EXCEPTION 'Workspace storage is full. Remove old media before importing audio.'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reserve_audio_storage AFTER INSERT OR DELETE ON audio_imports FOR EACH ROW EXECUTE FUNCTION reserve_audio_import_storage();
REVOKE ALL ON FUNCTION reserve_audio_import_storage() FROM PUBLIC;
