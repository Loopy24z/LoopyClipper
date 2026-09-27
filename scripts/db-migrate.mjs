import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import postgres from 'postgres';

for (const path of ['.env.local', '.env']) {
  try { loadEnvFile(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before applying migrations.');
const sql = postgres(process.env.DATABASE_URL, {
  max: 1, prepare: false,
  ssl: process.env.DATABASE_SSL === 'disable' ? false : 'require',
});
try {
  await sql.begin(async transaction => {
    await transaction`SELECT pg_advisory_xact_lock(684249127)`;
    await transaction`CREATE TABLE IF NOT EXISTS public.loofy_migrations (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`;
    await transaction`ALTER TABLE public.loofy_migrations ENABLE ROW LEVEL SECURITY`;
    await transaction`REVOKE ALL ON public.loofy_migrations FROM PUBLIC`;
    await transaction.unsafe(`DO $$ DECLARE role_name text; BEGIN FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON public.loofy_migrations FROM %I',role_name); END IF; END LOOP; END $$`);
    const directory = new URL('../supabase/migrations/', import.meta.url);
    for (const name of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) {
      const source = await readFile(new URL(name, directory), 'utf8');
      const checksum = createHash('sha256').update(source).digest('hex');
      const [existing] = await transaction`SELECT sha256 FROM public.loofy_migrations WHERE name=${name}`;
      if (existing) {
        if (existing.sha256 !== checksum) throw new Error(`Applied migration changed: ${name}. Add a new migration instead.`);
        continue;
      }
      await transaction.unsafe(source);
      await transaction`INSERT INTO public.loofy_migrations(name,sha256) VALUES(${name},${checksum})`;
      console.log(`Applied ${name}`);
    }
  });
  console.log('Database migrations are current.');
} finally { await sql.end(); }
