#!/usr/bin/env node
/**
 * Creates a 1 THB test product (automatic encrypted delivery) and lowers the
 * minimum wallet deposit to 1 THB so the owner can test the live flow.
 *
 * Safe/idempotent: re-running does not duplicate the product or inventory.
 */
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createCipheriv, randomBytes } from "node:crypto";

const root = resolve(import.meta.dirname, "..");
for (const file of [".env.local", ".env"]) {
  const path = join(root, file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

const databaseUrl = (process.env.DATABASE_URL || "").trim();
let db;
let close;
if (databaseUrl) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: databaseUrl, ssl: (process.env.PGSSL || "require") === "require" ? { rejectUnauthorized: false } : undefined });
  db = { query: async (sql, values = []) => (await pool.query(sql, values)).rows, exec: async (sql) => void (await pool.query(sql)) };
  close = () => pool.end();
} else {
  mkdirSync(join(root, ".data", "pglite"), { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = await PGlite.create({ dataDir: join(root, ".data", "pglite") });
  db = { query: async (sql, values = []) => (await pg.query(sql, values)).rows, exec: async (sql) => pg.exec(sql) };
  close = () => pg.close();
}
const q = (sql, values = []) => db.query(sql, values);
const one = async (sql, values = []) => (await q(sql, values))[0] ?? null;

function encryptSecret(plaintext) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be a 32-byte base64 key.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

// Ensure a category exists for the test item.
let category = await one("select id from categories where slug = 'digital-services'");
if (!category) {
  category = await one(
    `insert into categories(slug, name_th, name_en, icon, sort_order, is_active)
     values ('digital-services','บริการดิจิทัล','Other Digital Services','Sparkles',999,true)
     returning id`,
  );
}

const slug = "test-digital-delivery-1-thb";
let product = await one("select id from products where slug = $1", [slug]);
if (!product) {
  product = await one(
    `insert into products(category_id, slug, name_th, name_en, short_description, description, product_type,
       price, compare_at_price, stock_mode, stock_quantity, badge, is_active, is_featured, delivery_method,
       delivery_time, terms, metadata, sort_order)
     values ($1,$2,$3,$4,$5,$6,'digital_key','1.00',null,'inventory',0,'TEST 1฿',true,false,'auto','Instant',$7,$8::jsonb,998)
     returning id`,
    [
      category.id,
      slug,
      "สินค้าทดสอบ 1 บาท (ส่งมอบอัตโนมัติ)",
      "TEST ITEM — 1 THB Automatic Delivery",
      "ใช้สำหรับทดสอบการซื้อและการส่งมอบอัตโนมัติเท่านั้น",
      "สินค้าทดสอบราคา 1 บาท ใช้ตรวจสอบ flow ทั้งหมด: เติมเงิน → ซื้อ → ส่งมอบ → ดูข้อมูลใน My Products\n\nThis is a test product for end-to-end verification. It is not a real game product.",
      "สินค้าทดสอบ ไม่ใช่สินค้าจริง",
      JSON.stringify({ features: ["ราคา 1 บาท", "ส่งมอบอัตโนมัติ", "ข้อมูลเข้ารหัส", "ใช้ทดสอบเท่านั้น"] }),
    ],
  );
  console.log("[test-product] created", slug);
} else {
  console.log("[test-product] already exists", slug);
}

const inventoryCount = await one("select count(*)::int as c from product_inventory where product_id = $1", [product.id]);
if (Number(inventoryCount.c) === 0) {
  for (let i = 1; i <= 10; i++) {
    const payload = {
      username: `test_delivery_${String(i).padStart(2, "0")}`,
      password: `Test#${randomBytes(4).toString("hex")}`,
      email: `test${i}@demo.nextgen.local`,
      notes: "TEST ITEM — replace/remove before production",
    };
    await q(
      "insert into product_inventory(product_id, encrypted_payload, payload_hint) values ($1,$2,$3)",
      [product.id, encryptSecret(JSON.stringify(payload)), payload.username],
    );
  }
}
await q(
  `update products set is_active = true, price = '1.00',
     stock_quantity = (select count(*)::int from product_inventory where product_id = $1 and status = 'AVAILABLE')
   where id = $1`,
  [product.id],
);

await q(
  `insert into system_settings(key, value, updated_at) values ('payment.min_deposit', '1'::jsonb, now())
   on conflict (key) do update set value = '1'::jsonb, updated_at = now()`,
);
console.log("[test-product] minimum wallet deposit set to 1 THB");
console.log("[test-product] open /products/test-digital-delivery-1-thb");
await close();
