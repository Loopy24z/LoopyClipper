import postgres from 'postgres';
import { AsyncLocalStorage } from 'node:async_hooks';
const transactionContext = new AsyncLocalStorage<Driver>();

type Row = Record<string, unknown>;
type QueryRows = Row[] & { count?: number };
type Driver = {
  unsafe: (sql: string, values: any[]) => PromiseLike<QueryRows>;
  begin: <T>(fn: (transaction: Driver) => Promise<T>) => Promise<T>;
};

// Parameter conversion only. Queries themselves must use PostgreSQL syntax.
function parameters(sql: string) {
  let index = 0;
  return sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$[\s\S]*?\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$|--[^\n]*|\/\*[\s\S]*?\*\/|\?/g,
    token => token === '?' ? `$${++index}` : token);
}

class Statement {
  private values: any[] = [];
  private client: Driver;
  private text: string;
  constructor(client: Driver, text: string) { this.client = client; this.text = text; }
  bind(...values: any[]) { this.values = values; return this; }
  async execute(client = this.client) {
    const rows = await client.unsafe(parameters(this.text), this.values);
    return { results: Array.from(rows), success: true, meta: { changes: rows.count ?? 0 } };
  }
  async first<T = Row>(): Promise<T | null> { return (await this.execute()).results[0] as T ?? null; }
  async all<T = Row>() { const result = await this.execute(); return { ...result, results: result.results as T[] }; }
  run() { return this.execute(); }
}

export function createDatabase(client: Driver) {
  return {
    transaction: <T>(callback: () => Promise<T>): Promise<T> => client.begin(transaction => {
      const scoped: Driver = { unsafe: transaction.unsafe.bind(transaction), begin: fn => fn(transaction) };
      return transactionContext.run(scoped, callback);
    }),
    prepare: (sql: string) => new Statement(transactionContext.getStore() || client, sql),
    batch: (statements: Statement[]) => (transactionContext.getStore() || client).begin(async transaction => {
      const results = [];
      for (const statement of statements) results.push(await statement.execute(transaction));
      return results;
    }),
  };
}

let database: ReturnType<typeof createDatabase> | undefined;
export function db(): ReturnType<typeof createDatabase> {
  if (!database) {
    if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL with the Supabase server database connection.');
    const client = postgres(process.env.DATABASE_URL, {
      prepare: false, // Supabase transaction pooler does not support prepared statements.
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: process.env.DATABASE_SSL === 'disable' ? false : 'require',
      types: {
        // Schema bounds keep timestamps, counts and byte sums within Number's safe range.
        number: { to: 20, from: [20, 1700], serialize: String, parse: (value: string) => {
          const number = Number(value);
          if (!Number.isFinite(number) || Math.abs(number) > Number.MAX_SAFE_INTEGER) throw new Error('Database number exceeds the supported range.');
          return number;
        } },
      },
    });
    database = createDatabase(client as unknown as Driver);
  }
  return database;
}
