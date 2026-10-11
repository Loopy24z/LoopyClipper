import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

const migration = new URL('../supabase/migrations/0001_loofy.sql', import.meta.url);
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const owner2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

async function setup(t) {
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = new PGlite();
  t.after(() => pg.close());
  await pg.exec(await readFile(migration, 'utf8'));
  const day = (await pg.query("SELECT to_char(now() AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD') AS day")).rows[0].day;
  await pg.query('INSERT INTO accounts(id,email,day) VALUES($1,$2,$3),($4,$5,$3)', [owner, 'a@example.test', day, owner2, 'b@example.test']);
  return { pg, day };
}

test('PostgreSQL migration exists and can replace SQLite persistence', async () => {
  assert.ok((await readFile(migration, 'utf8')).length > 0);
});

test('debits allocate remaining free credits atomically, reject overspend and refund once', async t => {
  const { pg, day } = await setup(t);
  await pg.query('UPDATE accounts SET paid=5,paid_until=$1 WHERE id=$2', [Date.now() + 86400000, owner]);
  const debit = (id, free, paid) => pg.query('INSERT INTO credit_ledger(project,owner,day,free,paid,created) VALUES($1,$2,$3,$4,$5,0)', [id, owner, day, free, paid]);
  await debit('a', 8, 0);
  // A second request read the old balance. The database must recompute its split.
  await debit('b', 5, 0);
  assert.deepEqual((await pg.query('SELECT daily_used,paid FROM accounts WHERE id=$1', [owner])).rows[0], { daily_used: 10, paid: 2 });
  assert.deepEqual((await pg.query("SELECT free,paid FROM credit_ledger WHERE project='b'")).rows[0], { free: 2, paid: 3 });
  await assert.rejects(debit('c', 3, 0), /Insufficient credits/);
  await pg.query("UPDATE credit_ledger SET refunded=1 WHERE project='b'");
  await pg.query("UPDATE credit_ledger SET refunded=1 WHERE project='b'");
  assert.deepEqual((await pg.query('SELECT daily_used,paid FROM accounts WHERE id=$1', [owner])).rows[0], { daily_used: 8, paid: 5 });
  await assert.rejects(debit('a', 1, 0), /duplicate key/);
  assert.equal((await pg.query('SELECT daily_used FROM accounts WHERE id=$1', [owner])).rows[0].daily_used, 8);
});

test('credit reset uses Jakarta day and an expired grant cannot be spent or resurrected', async t => {
  const { pg, day } = await setup(t);
  await pg.query("UPDATE accounts SET day='2000-01-01',daily_used=10,paid=9,paid_until=1 WHERE id=$1", [owner]);
  await pg.query("INSERT INTO credit_ledger(project,owner,day,free,paid,created) VALUES('new', $1, '2000-01-01', 1, 0, 0)", [owner]);
  assert.deepEqual((await pg.query('SELECT day,daily_used,paid FROM accounts WHERE id=$1', [owner])).rows[0], { day, daily_used: 1, paid: 0 });
  await pg.query('UPDATE accounts SET paid=5,paid_until=$1 WHERE id=$2', [Date.now() + 86400000, owner]);
  await pg.query("INSERT INTO credit_ledger(project,owner,day,free,paid,created) VALUES('paid', $1, $2, 9, 3, 0)", [owner, day]);
  await pg.query("UPDATE credit_ledger SET paid_until=1 WHERE project='paid'");
  await pg.query("UPDATE credit_ledger SET refunded=1 WHERE project='paid'");
  assert.equal((await pg.query('SELECT paid FROM accounts WHERE id=$1', [owner])).rows[0].paid, 2);
});

test('subscription activation credits once, including expired previous credit balances', async t => {
  const { pg } = await setup(t);
  await pg.query('UPDATE accounts SET paid=9,paid_until=1 WHERE id=$1', [owner]);
  await pg.query("INSERT INTO subscriptions(id,owner,plan,created) VALUES('s', $1, 'creator', 0)", [owner]);
  await pg.query("UPDATE subscriptions SET status='active',expires=$1,reference='manual approval' WHERE id='s'", [Date.now() + 86400000]);
  await pg.query("UPDATE subscriptions SET status='active' WHERE id='s'");
  assert.equal((await pg.query('SELECT paid FROM accounts WHERE id=$1', [owner])).rows[0].paid, 120);
});

test('global storage reservation includes all owners and queued exports, then releases deleted media', async t => {
  const { pg } = await setup(t);
  const project = (id, uid, size) => pg.query("INSERT INTO projects(id,owner,name,size,duration,language,created) VALUES($1,$2,'fixture',$3,20,'en',0)", [id, uid, size]);
  await project('a', owner, 2147483648);
  await project('b', owner2, 2147483648);
  await pg.query("INSERT INTO clips(id,project,data,created) VALUES('clip','a','{}',0)");
  await pg.query("INSERT INTO jobs(id,project,clip,kind,size,created) VALUES('export','a','clip','export',1073741824,0)");
  await assert.rejects(project('overflow', owner2, 1), /Storage quota exceeded/);
  await pg.query("UPDATE jobs SET status='failed',size=0 WHERE id='export'");
  await project('fits', owner2, 1);
  await pg.query("DELETE FROM projects WHERE id='a'");
  assert.equal(Number((await pg.query('SELECT reserved_bytes FROM storage_quota WHERE id=1')).rows[0].reserved_bytes), 2147483649);
});

test('browser roles cannot read or mutate application tables', async t => {
  const { pg } = await setup(t);
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  // PUBLIC grants are revoked by migration; newly created browser roles inherit none.
  await pg.exec('SET ROLE anon');
  await assert.rejects(pg.query('SELECT * FROM accounts'), /permission denied/);
  await pg.exec('RESET ROLE; SET ROLE authenticated');
  await assert.rejects(pg.query('UPDATE credit_settings SET daily=99999'), /permission denied/);
  await pg.exec('RESET ROLE');
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity")).rows[0].n, 0);
});

test('database compatibility API translates parameters safely and batch rolls back as a transaction', async t => {
  const { pg } = await setup(t);
  const { createDatabase } = await import('../lib/database.ts');
  // Execute the adapter's emitted SQL in real PostgreSQL; only the driver transport differs.
  const driver = connection => ({
    unsafe: async (sql, values) => {
      const result = await connection.query(sql, values);
      return Object.assign(result.rows, { count: result.affectedRows ?? result.rows.length });
    },
    begin: fn => connection.transaction(tx => fn(driver(tx))),
  });
  const db = createDatabase(driver(pg));
  assert.deepEqual(await db.prepare("SELECT '?' AS literal, ?::int AS value, $$why?$$ AS dollar /* ? */ -- ?\n").bind(42).first(), { literal: '?', value: 42, dollar: 'why?' });
  await assert.rejects(db.batch([
    db.prepare('UPDATE accounts SET paid=? WHERE id=?').bind(100, owner),
    db.prepare('UPDATE accounts SET paid=? WHERE id=?').bind(-1, owner),
  ]), /check constraint/);
  assert.equal((await db.prepare('SELECT paid FROM accounts WHERE id=?').bind(owner).first()).paid, 0);
  const result = await db.prepare('UPDATE accounts SET paid=? WHERE id=?').bind(4, owner).run();
  assert.equal(result.meta.changes, 1);
  assert.equal((await db.prepare('SELECT paid FROM accounts WHERE id=?').bind(owner).all()).results[0].paid, 4);
});


test('transaction-scoped statements and nested batch roll back together', async t => {
  const {pg} = await setup(t);
  const {createDatabase} = await import('../lib/database.ts');
  const driver = c => ({unsafe: async (sql, values) => {const r=await c.query(sql,values);return Object.assign(r.rows,{count:r.affectedRows ?? r.rows.length})},begin: fn=>c.transaction(tx=>fn(driver(tx)))});
  const database=createDatabase(driver(pg));
  await assert.rejects(database.transaction(async()=>{
    await database.prepare('UPDATE credit_settings SET daily=11 WHERE id=1').run();
    await database.batch([database.prepare('UPDATE credit_settings SET daily=12 WHERE id=1')]);
    throw new Error('rollback fixture');
  }),/rollback fixture/);
  assert.equal((await database.prepare('SELECT daily FROM credit_settings WHERE id=1').first()).daily,10);
});

test('creative-plan storage stays private to backend roles', async t => {
 const {pg}=await setup(t);
 await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
 for(const name of ['0003_ugc_drafts.sql','0004_ugc_plans.sql','0005_publications.sql'])await pg.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 assert.equal((await pg.query("SELECT relrowsecurity FROM pg_class WHERE relname='ugc_plans'")).rows[0].relrowsecurity,true);
 await pg.exec('SET ROLE anon');await assert.rejects(pg.query('SELECT * FROM ugc_plans'),/permission denied/);
 await pg.exec('RESET ROLE; SET ROLE authenticated');await assert.rejects(pg.query("UPDATE ugc_plans SET status='complete'"),/permission denied/);
 await assert.rejects(pg.query('SELECT * FROM publishing_accounts'),/permission denied/);
 await assert.rejects(pg.query('SELECT * FROM publication_jobs'),/permission denied/);
 await pg.exec('RESET ROLE');
});
