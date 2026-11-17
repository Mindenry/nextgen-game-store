import "server-only";
import { readFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Pool as PgPool, PoolClient } from "pg";
import { env, runtimeMode } from "@/lib/env";

export type Row = Record<string, unknown>;

export interface Queryable {
  query<T extends Row = Row>(text: string, values?: unknown[]): Promise<T[]>;
}

export interface Db extends Queryable {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  exec(sql: string): Promise<void>;
}

type Globals = typeof globalThis & {
  __ngsPgPool?: PgPool;
  __ngsPglite?: unknown;
  __ngsDbPromise?: Promise<Db>;
  __ngsMigrationsApplied?: boolean;
};

const g = globalThis as Globals;

function logDb(message: string) {
  if (runtimeMode === "local") console.log(`[db] ${message}`);
}

async function applyMigrations(runner: { exec(sql: string): Promise<void>; query: Queryable["query"] }, mode: "local" | "supabase") {
  const dir = join(process.cwd(), "supabase", "migrations");
  if (!existsSync(dir)) {
    logDb("no migrations directory found, skipping");
    return;
  }
  await runner.exec(
    "create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())",
  );
  const appliedRows = await runner.query<{ version: string }>("select version from schema_migrations");
  const applied = new Set(appliedRows.map((r) => r.version));
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => (mode === "local" ? !f.includes(".supabase.") : !f.includes(".local.")))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(dir, file), "utf8");
    try {
      await runner.exec(sql);
      await runner.query("insert into schema_migrations(version) values ($1) on conflict do nothing", [file]);
      logDb(`applied ${file}`);
    } catch (error) {
      console.error(`[db] migration failed: ${file}`, error);
      throw error;
    }
  }
}

async function createPgDb(): Promise<Db> {
  const { Pool } = await import("pg");
  const pool =
    g.__ngsPgPool ??
    new Pool({
      connectionString: env.databaseUrl,
      max: env.poolMax,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
      application_name: "nextgen-game-store",
      ssl: env.pgSsl === "require" ? { rejectUnauthorized: false } : undefined,
    });
  g.__ngsPgPool = pool;

  const query = async <T extends Row = Row>(text: string, values: unknown[] = []): Promise<T[]> => {
    const result = await pool.query(text, values as never[]);
    return result.rows as T[];
  };

  const db: Db = {
    query,
    exec: async (sql) => {
      await pool.query(sql);
    },
    transaction: async (fn) => {
      const client: PoolClient = await pool.connect();
      try {
        await client.query("BEGIN");
        const tx: Queryable = {
          query: async <T extends Row = Row>(text: string, values: unknown[] = []): Promise<T[]> => {
            const result = await client.query(text, values as never[]);
            return result.rows as T[];
          },
        };
        const result = await fn(tx);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
  };

  if (!g.__ngsMigrationsApplied && env.nodeEnv !== "production") {
    try {
      await applyMigrations(db, "supabase");
      g.__ngsMigrationsApplied = true;
    } catch {
      // Build-time / read-only credentials may not be allowed to migrate.
      // Production migrations are run explicitly with `npm run db:migrate`.
    }
  }
  return db;
}

async function createLocalDb(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = join(process.cwd(), ".data", "pglite");
  mkdirSync(dataDir, { recursive: true });
  const pg = (g.__ngsPglite ?? (await PGlite.create({ dataDir }))) as InstanceType<typeof PGlite>;
  g.__ngsPglite = pg;

  // PGlite is single-connection. Serialise every top-level operation so a
  // concurrent read (Next.js prefetch/render) can never interleave with an
  // open transaction and deadlock the connection. Queries issued through the
  // transaction handle bypass this queue by design.
  let operationQueue: Promise<unknown> = Promise.resolve();
  function serialise<T>(operation: () => Promise<T>): Promise<T> {
    const run = operationQueue.then(operation, operation);
    operationQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  const query = async <T extends Row = Row>(text: string, values: unknown[] = []): Promise<T[]> =>
    serialise(async () => {
      const result = await pg.query(text, values);
      return result.rows as T[];
    });

  const db: Db = {
    query,
    exec: async (sql) => {
      await serialise(() => pg.exec(sql));
    },
    transaction: async (fn) => {
      return serialise(async () => {
        await pg.exec("BEGIN");
        const tx: Queryable = {
          query: async <T extends Row = Row>(text: string, values: unknown[] = []): Promise<T[]> => {
            const result = await pg.query(text, values);
            return result.rows as T[];
          },
        };
        try {
          const result = await fn(tx);
          await pg.exec("COMMIT");
          return result;
        } catch (error) {
          await pg.exec("ROLLBACK").catch(() => undefined);
          throw error;
        }
      });
    },
  };

  if (!g.__ngsMigrationsApplied) {
    await applyMigrations(db, "local");
    g.__ngsMigrationsApplied = true;
  }
  return db;
}

export function getDb(): Promise<Db> {
  if (!g.__ngsDbPromise) {
    g.__ngsDbPromise = (env.databaseUrl ? createPgDb() : createLocalDb()).catch((error) => {
      g.__ngsDbPromise = undefined;
      throw error;
    });
  }
  return g.__ngsDbPromise;
}

export async function one<T extends Row = Row>(
  text: string,
  values: unknown[] = [],
  db?: Queryable,
): Promise<T | null> {
  const rows = await (db ?? (await getDb())).query<T>(text, values);
  return rows[0] ?? null;
}

export async function many<T extends Row = Row>(
  text: string,
  values: unknown[] = [],
  db?: Queryable,
): Promise<T[]> {
  return (db ?? (await getDb())).query<T>(text, values);
}

/** Run a statement that does not return rows. */
export async function run(text: string, values: unknown[] = []): Promise<void> {
  await (await getDb()).query(text, values);
}

export async function withTransaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
  return (await getDb()).transaction(fn);
}

/** Execute migrations explicitly (CLI / deploy). */
export async function migrateDatabase(): Promise<void> {
  const db = await getDb();
  g.__ngsMigrationsApplied = false;
  await applyMigrations(db, env.databaseUrl ? "supabase" : "local");
  g.__ngsMigrationsApplied = true;
}
