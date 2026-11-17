#!/usr/bin/env node
/**
 * Applies supabase/migrations/*.sql to the configured database.
 * - With DATABASE_URL: connects to Supabase/Postgres via pg.
 * - Without: uses the embedded PGlite database in .data/pglite.
 */
import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      const key = match[1];
      if (process.env[key] !== undefined) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

loadEnv();

const databaseUrl = (process.env.DATABASE_URL || "").trim();
const isSupabase = Boolean(databaseUrl);
const dir = join(root, "supabase", "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .filter((f) => (isSupabase ? !f.includes(".local.") : !f.includes(".supabase.")))
  .sort();

let db;
if (isSupabase) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 2,
    ssl: (process.env.PGSSL || "require") === "require" ? { rejectUnauthorized: false } : undefined,
  });
  db = {
    exec: async (sql) => {
      await pool.query(sql);
    },
    query: async (sql, values = []) => (await pool.query(sql, values)).rows,
    close: async () => pool.end(),
  };
  console.log("[db:migrate] target: Supabase / external Postgres");
} else {
  mkdirSync(join(root, ".data", "pglite"), { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = await PGlite.create({ dataDir: join(root, ".data", "pglite") });
  db = {
    exec: async (sql) => {
      await pg.exec(sql);
    },
    query: async (sql, values = []) => (await pg.query(sql, values)).rows,
    close: async () => pg.close(),
  };
  console.log("[db:migrate] target: embedded PGlite (.data/pglite)");
}

await db.exec(
  "create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())",
);
const appliedRows = await db.query("select version from schema_migrations");
const applied = new Set(appliedRows.map((r) => r.version));

let count = 0;
for (const file of files) {
  if (applied.has(file)) {
    console.log(`  = skipped ${file}`);
    continue;
  }
  process.stdout.write(`  > ${file} ... `);
  try {
    await db.exec(readFileSync(join(dir, file), "utf8"));
    await db.query("insert into schema_migrations(version) values ($1) on conflict do nothing", [file]);
    console.log("ok");
    count++;
  } catch (error) {
    console.log("FAILED");
    console.error(error);
    await db.close();
    process.exit(1);
  }
}
console.log(`[db:migrate] done — ${count} migration(s) applied, ${files.length} total.`);
await db.close();
