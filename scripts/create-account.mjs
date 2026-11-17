#!/usr/bin/env node
/**
 * Creates a single verified customer account with a zero wallet balance.
 *
 * Usage (development / self-hosted database):
 *   node scripts/create-account.mjs --email=player1@nextgen.local \
 *        --password='Player1234!' --name='Player One' --username=player1
 *
 * Flags are optional except email and password:
 *   --email      required, unique
 *   --password   required, min 8 characters
 *   --name       display name (default: "Player")
 *   --username   optional, 3-20 chars [A-Za-z0-9_]
 *
 * The account is created with email_verified_at = now() so it can top up and
 * check out immediately. The wallet row starts at 0.00 — no credit is applied.
 */
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomBytes, scryptSync } from "node:crypto";

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

function arg(name) {
  const direct = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1];
  return undefined;
}

const email = (arg("email") || "").trim().toLowerCase();
const password = arg("password") || "";
const displayName = (arg("name") || "Player").trim();
const usernameRaw = (arg("username") || "").trim();
const username = usernameRaw ? usernameRaw.toLowerCase() : null;

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("[account] --email is required and must be a valid address.");
  process.exit(1);
}
if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
  console.error("[account] --password must be at least 8 characters and contain a letter and a number.");
  process.exit(1);
}
if (username && !/^[a-z0-9_]{3,20}$/.test(username)) {
  console.error("[account] --username must be 3-20 characters, letters/numbers/underscore.");
  process.exit(1);
}

function hashPassword(plaintext) {
  const salt = randomBytes(16);
  const N = 16384;
  const r = 8;
  const p = 1;
  const derived = scryptSync(plaintext.normalize("NFKC"), salt, 64, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", N, r, p, salt.toString("base64url"), derived.toString("base64url")].join("$");
}

// ---------------------------------------------------------------- db driver
const databaseUrl = (process.env.DATABASE_URL || "").trim();
let db;
let close;
if (databaseUrl) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: (process.env.PGSSL || "require") === "require" ? { rejectUnauthorized: false } : undefined,
  });
  db = { query: async (sql, values = []) => (await pool.query(sql, values)).rows };
  close = () => pool.end();
} else {
  mkdirSync(join(root, ".data", "pglite"), { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = await PGlite.create({ dataDir: join(root, ".data", "pglite") });
  db = { query: async (sql, values = []) => (await pg.query(sql, values)).rows };
  close = () => pg.close();
}
const q = (sql, values) => db.query(sql, values);
const one = async (sql, values) => (await q(sql, values))[0] ?? null;

try {
  const existing = await one("select id from profiles where email_lower = $1", [email]);
  if (existing) {
    console.error(`[account] ${email} already exists. Use a different email.`);
    process.exitCode = 1;
  } else {
    if (username) {
      const taken = await one("select id from profiles where lower(username) = $1", [username]);
      if (taken) throw new Error(`username "${username}" is already taken`);
    }
    const created = await one(
      `insert into profiles(email, password_hash, display_name, username, email_verified_at)
       values ($1,$2,$3,$4, now()) returning id, email, display_name, created_at`,
      [email, hashPassword(password), displayName, username],
    );
    await q("insert into wallets(user_id, balance) values ($1, 0) on conflict (user_id) do nothing", [created.id]);
    await q(
      `insert into notifications(user_id, type, title, body, link)
       values ($1, 'account', 'Welcome to NEXTGEN GAME STORE', 'Your account is ready. Your wallet balance is ฿0.00 — top up when you want to buy.', '/dashboard/wallet/topup')`,
      [created.id],
    );
    const wallet = await one("select balance from wallets where user_id = $1", [created.id]);
    console.log("");
    console.log("================================================================");
    console.log("  ACCOUNT CREATED");
    console.log("  Email:    " + created.email);
    console.log("  Password: " + password);
    console.log("  Name:     " + created.display_name);
    console.log("  Username: " + (username ?? "-"));
    console.log("  Role:     customer (email verified)");
    console.log("  Wallet:   ฿" + Number(wallet?.balance ?? 0).toFixed(2));
    console.log("================================================================");
  }
} finally {
  await close();
}
