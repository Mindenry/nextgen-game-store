#!/usr/bin/env node
/**
 * Development-only demo data. Requires SEED_DEMO=true.
 * Creates: bootstrap admin, demo customer, catalogue, inventory units,
 * game top-up games/packages, banners, promotions, coupons and two sample
 * orders (one completed with a review, one pending top-up) so every dashboard
 * has real database rows to exercise.
 *
 * NEVER run this against production data.
 */
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID, scryptSync, randomBytes, createCipheriv } from "node:crypto";

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
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[key] = value;
    }
  }
}
loadEnv();

if ((process.env.SEED_DEMO || "").trim() !== "true") {
  console.error("[seed] SEED_DEMO is not true. Refusing to seed.");
  process.exit(1);
}
if ((process.env.NODE_ENV || "").trim() === "production") {
  console.error("[seed] NODE_ENV=production. Refusing to seed demo data.");
  process.exit(1);
}

// ---------------------------------------------------------------- db driver
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

const q = (sql, values) => db.query(sql, values);
const one = async (sql, values) => (await q(sql, values))[0] ?? null;

// --------------------------------------------------------------- utilities
function hashPassword(password) {
  const salt = randomBytes(16);
  const N = 16384, r = 8, p = 1, keylen = 64;
  const derived = scryptSync(password.normalize("NFKC"), salt, keylen, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", N, r, p, salt.toString("base64url"), derived.toString("base64url")].join("$");
}
function encryptSecret(plaintext) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be a 32-byte base64 key.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}
const money = (n) => Number(n).toFixed(2);

// ------------------------------------------------------------- bootstrap user
const adminEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@nextgen.local").toLowerCase();
const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || "ChangeMe123!";
const adminName = process.env.BOOTSTRAP_ADMIN_NAME || "Store Owner";
let admin = await one("select id from profiles where email_lower = $1", [adminEmail]);
if (!admin) {
  admin = await one(
    `insert into profiles(email, password_hash, display_name, role_id, email_verified_at)
     values ($1,$2,$3,'super_admin', now()) returning id`,
    [adminEmail, hashPassword(adminPassword), adminName],
  );
  console.log(`[seed] admin created: ${adminEmail}`);
} else {
  await q("update profiles set role_id = 'super_admin', email_verified_at = coalesce(email_verified_at, now()), password_hash = coalesce(password_hash, $2) where id = $1", [admin.id, hashPassword(adminPassword)]);
  console.log(`[seed] admin exists: ${adminEmail}`);
}

// ------------------------------------------------------------- demo customer
const customerEmail = "demo@nextgen.local";
let customer = await one("select id from profiles where email_lower = $1", [customerEmail]);
if (!customer) {
  customer = await one(
    `insert into profiles(email, password_hash, display_name, username, email_verified_at)
     values ($1,$2,$3,'demo_player', now()) returning id`,
    [customerEmail, hashPassword("Demo1234!"), "Demo Player"],
  );
  console.log(`[seed] demo customer created: ${customerEmail} / Demo1234!`);
} else {
  customer = await one("select id from profiles where id = $1", [customer.id]);
}

// --------------------------------------------------------------- categories
const categories = [
  ["game-accounts", "ไอดีเกม", "Game Accounts", "Gamepad2"],
  ["game-topup", "เติมเกม", "Game Top-Up", "Zap"],
  ["steam-games", "เกม Steam", "Steam Games", "MonitorPlay"],
  ["minecraft", "Minecraft", "Minecraft Accounts", "Boxes"],
  ["roblox", "Roblox", "Roblox Products", "Blocks"],
  ["mobile-games", "เกมมือถือ", "Mobile Games", "Smartphone"],
  ["pc-games", "เกม PC", "PC Games", "PcCase"],
  ["gift-cards", "บัตรของขวัญ", "Gift Cards", "Gift"],
  ["software-keys", "ซอฟต์แวร์", "Software & Digital Keys", "KeyRound"],
  ["digital-services", "บริการดิจิทัล", "Other Digital Services", "Sparkles"],
];
for (const [slug, th, en, icon] of categories) {
  await q(
    `insert into categories(slug, name_th, name_en, icon, sort_order) values ($1,$2,$3,$4,$5)
     on conflict (slug) do update set name_th = excluded.name_th, name_en = excluded.name_en`,
    [slug, th, en, icon, categories.findIndex((c) => c[0] === slug) + 1],
  );
}
const catRows = await q("select id, slug from categories");
const cat = Object.fromEntries(catRows.map((row) => [row.slug, row.id]));

const IMAGES = {
  accounts: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
  steam: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80",
  neon: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=1200&q=80",
  pc: "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&w=1200&q=80",
};

const products = [
  { slug: "valorant-immortal-account", cat: "game-accounts", th: "ไอดี Valorant แรงค์ Immortal", en: "Valorant Immortal Account", price: 1290, compare: 1590, type: "game_account", featured: true, badge: "Verified", image: IMAGES.accounts, stock: 2, delivery: "auto", short: "Full-access Immortal account with original email.", desc: "A verified Valorant Immortal account with full access. Includes original email access and a 7-day replacement warranty if the account is recovered by the previous owner within the warranty window." },
  { slug: "genshin-ar60-account", cat: "game-accounts", th: "ไอดี Genshin AR60", en: "Genshin Impact AR60 Account", price: 2490, compare: 2990, type: "game_account", featured: true, badge: "Rare", image: IMAGES.accounts, stock: 1, delivery: "auto", short: "AR60 account with 5-star characters and full map.", desc: "Adventure Rank 60 account with multiple five-star characters, completed Archon quests and an explorable map. Credentials are delivered automatically after payment." },
  { slug: "elden-ring-steam-key", cat: "steam-games", th: "คีย์ Steam Elden Ring", en: "Elden Ring Steam Key", price: 1290, compare: 1690, type: "digital_key", featured: true, badge: "Best seller", image: IMAGES.steam, stock: 3, delivery: "auto", short: "Global Steam key, instant activation.", desc: "Elden Ring for Steam, global region. Redeem the key in your Steam library. Instant automatic delivery after payment." },
  { slug: "cyberpunk-2077-ultimate", cat: "steam-games", th: "Cyberpunk 2077 Ultimate Edition", en: "Cyberpunk 2077 Ultimate Edition", price: 1590, compare: 1990, type: "digital_key", featured: false, badge: null, image: IMAGES.neon, stock: 2, delivery: "auto", short: "Base game plus Phantom Liberty on Steam.", desc: "Cyberpunk 2077 Ultimate Edition Steam key including the Phantom Liberty expansion. Global key, instant delivery." },
  { slug: "minecraft-java-bedrock", cat: "minecraft", th: "Minecraft Java + Bedrock", en: "Minecraft Java + Bedrock Edition", price: 690, compare: 890, type: "digital_key", featured: true, badge: "Official", image: IMAGES.pc, stock: 2, delivery: "auto", short: "Full access account, Java and Bedrock.", desc: "Minecraft account with both Java and Bedrock editions. Full account access with the ability to change the email and password after first login." },
  { slug: "roblox-1000-robux", cat: "roblox", th: "Roblox 1,000 Robux", en: "Roblox 1,000 Robux", price: 349, compare: 399, type: "gift_card", featured: false, badge: null, image: IMAGES.neon, stock: 5, delivery: "auto", short: "Digital Robux gift code delivered instantly.", desc: "A 1,000 Robux digital gift code. Redeem it on the official Roblox website. Region-free code delivered automatically." },
  { slug: "steam-wallet-500", cat: "gift-cards", th: "Steam Wallet 500 บาท", en: "Steam Wallet 500 THB", price: 515, compare: 530, type: "gift_card", featured: true, badge: "Instant", image: IMAGES.steam, stock: 5, delivery: "auto", short: "Steam Wallet code for the Thai region.", desc: "Steam Wallet 500 THB code for the Thailand region. Add the code to your Steam account to top up your wallet balance." },
  { slug: "google-play-300", cat: "gift-cards", th: "Google Play 300 บาท", en: "Google Play 300 THB", price: 309, compare: 320, type: "gift_card", featured: false, badge: null, image: IMAGES.steam, stock: 4, delivery: "auto", short: "Google Play gift code, TH region.", desc: "Google Play 300 THB gift card code for the Thailand region. Works for apps, games and in-app purchases." },
  { slug: "windows-11-pro-key", cat: "software-keys", th: "คีย์ Windows 11 Pro", en: "Windows 11 Pro Key", price: 490, compare: 990, type: "digital_key", featured: true, badge: "Lifetime", image: IMAGES.pc, stock: 4, delivery: "auto", short: "Retail key with lifetime activation.", desc: "Genuine Windows 11 Pro retail key, one PC, lifetime activation. Activation instructions included with delivery." },
  { slug: "microsoft-365-1-year", cat: "software-keys", th: "Microsoft 365 1 ปี", en: "Microsoft 365 Personal (1 Year)", price: 1190, compare: 1490, type: "digital_key", featured: false, badge: null, image: IMAGES.pc, stock: 2, delivery: "auto", short: "12-month subscription key for one user.", desc: "Microsoft 365 Personal 12-month subscription. Redeem at setup.office.com. Includes Word, Excel, PowerPoint and 1 TB OneDrive." },
  { slug: "discord-nitro-1-month", cat: "digital-services", th: "Discord Nitro 1 เดือน", en: "Discord Nitro (1 Month)", price: 129, compare: 169, type: "service", featured: false, badge: "Manual", image: IMAGES.neon, stock: 0, delivery: "manual", short: "Activated by our team on your account.", desc: "One month of Discord Nitro. Delivery is handled by our team via a support ticket. Provide your Discord username at checkout." },
  { slug: "mobile-legends-500-diamonds", cat: "mobile-games", th: "Mobile Legends 500 เพชร", en: "Mobile Legends 500 Diamonds", price: 149, compare: 179, type: "topup", featured: false, badge: null, image: IMAGES.neon, stock: 0, delivery: "manual", short: "Diamonds delivered to your player ID.", desc: "Use the Game Top-Up page for Mobile Legends diamond packages. This catalogue entry is for category visibility only." },
];

const productIds = {};
for (const product of products) {
  const existing = await one("select id from products where slug = $1", [product.slug]);
  let productId = existing?.id;
  if (!productId) {
    const row = await one(
      `insert into products(category_id, slug, name_th, name_en, short_description, description, product_type,
         price, compare_at_price, stock_mode, stock_quantity, badge, is_active, is_featured, delivery_method,
         delivery_time, terms, metadata, sort_order)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,$13,$14,$15,$16,$17::jsonb,$18)
       returning id`,
      [
        cat[product.cat], product.slug, product.th, product.en, product.short, product.desc, product.type,
        money(product.price), product.compare ? money(product.compare) : null,
        product.delivery === "manual" ? "manual" : "inventory", product.stock, product.badge,
        product.featured, product.delivery, product.delivery === "auto" ? "Instant" : "Within 24 hours",
        "Digital goods are non-refundable once delivered. Read the full refund policy before purchase.",
        JSON.stringify({ features: ["Server-verified stock", "Secure wallet checkout", "Support-backed delivery"] }),
        products.indexOf(product),
      ],
    );
    productId = row.id;
    if (product.image) {
      await q("insert into product_images(product_id, url, alt, sort_order) values ($1,$2,$3,0)", [productId, product.image, product.en]);
    }
    if (product.delivery === "auto") {
      const units = Math.max(1, Math.min(product.stock, 3));
      for (let i = 1; i <= units; i++) {
        const payload = {
          username: `${product.slug}_${String(i).padStart(2, "0")}`,
          password: `Demo#${randomBytes(4).toString("hex")}`,
          email: `${product.slug}_${i}@demo.nextgen.local`,
          notes: "DEMO inventory unit — replace with real stock before selling.",
        };
        await q(
          "insert into product_inventory(product_id, encrypted_payload, payload_hint) values ($1,$2,$3)",
          [productId, encryptSecret(JSON.stringify(payload)), payload.username],
        );
      }
      await q(
        "update products set stock_quantity = (select count(*)::int from product_inventory where product_id = $1 and status = 'AVAILABLE') where id = $1",
        [productId],
      );
    }
  }
  productIds[product.slug] = productId;
}
console.log(`[seed] products ready: ${Object.keys(productIds).length}`);

// -------------------------------------------------------------- top-up games
const games = [
  { slug: "free-fire", name: "Free Fire", fields: [
    { key: "player_id", label: "Player ID / UID", required: true, placeholder: "123456789", pattern: "^[0-9]{6,20}$" },
  ], packages: [["100 Diamonds", 35], ["310 Diamonds", 99], ["520 Diamonds", 159], ["1,060 Diamonds", 309]] },
  { slug: "pubg-mobile", name: "PUBG Mobile", fields: [
    { key: "player_id", label: "Player ID", required: true, placeholder: "51234567890", pattern: "^[0-9]{8,20}$" },
  ], packages: [["60 UC", 35], ["325 UC", 159], ["660 UC", 309]] },
  { slug: "mobile-legends", name: "Mobile Legends", fields: [
    { key: "user_id", label: "User ID", required: true, placeholder: "12345678", pattern: "^[0-9]{5,20}$" },
    { key: "zone_id", label: "Zone ID", required: true, placeholder: "1234", pattern: "^[0-9]{3,6}$" },
  ], packages: [["86 Diamonds", 65], ["172 Diamonds", 129], ["257 Diamonds", 189], ["706 Diamonds", 499]] },
  { slug: "roblox", name: "Roblox", fields: [
    { key: "username", label: "Roblox Username", required: true, placeholder: "player_name", pattern: "^[A-Za-z0-9_]{3,20}$" },
  ], packages: [["400 Robux", 149], ["800 Robux", 289], ["1,700 Robux", 579]] },
  { slug: "genshin-impact", name: "Genshin Impact", fields: [
    { key: "uid", label: "UID", required: true, placeholder: "800000000", pattern: "^[0-9]{9,12}$" },
    { key: "server", label: "Server", required: true, placeholder: "Asia / America / Europe / TW,HK,MO" },
  ], packages: [["60 Genesis Crystals", 35], ["300 + 30 Genesis Crystals", 169], ["980 + 110 Genesis Crystals", 529]] },
  { slug: "honkai-star-rail", name: "Honkai: Star Rail", fields: [
    { key: "uid", label: "UID", required: true, placeholder: "800000000", pattern: "^[0-9]{9,12}$" },
    { key: "server", label: "Server", required: true, placeholder: "Asia / America / Europe / TW,HK,MO" },
  ], packages: [["60 Oneiric Shards", 35], ["330 Oneiric Shards", 179], ["1,090 Oneiric Shards", 579]] },
];

for (const game of games) {
  let gameRow = await one("select id from game_topup_games where slug = $1", [game.slug]);
  if (!gameRow) {
    gameRow = await one(
      `insert into game_topup_games(slug, name, fields, sort_order, is_active) values ($1,$2,$3::jsonb,$4,true) returning id`,
      [game.slug, game.name, JSON.stringify(game.fields), games.indexOf(game)],
    );
  }
  for (const [name, price] of game.packages) {
    const slug = `${game.slug}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    await q(
      `insert into game_topup_products(game_id, slug, name, price, provider_id, delivery_type, is_active, sort_order)
       values ($1,$2,$3,$4,'manual','manual',true,$5)
       on conflict (slug) do nothing`,
      [gameRow.id, slug, name, money(price), game.packages.findIndex(([n]) => n === name)],
    );
  }
}
console.log(`[seed] top-up games ready: ${games.length}`);

// ------------------------------------------------------- banners, promotions
if (Number((await one("select count(*)::int as c from banners")).c) === 0) {
  await q(`insert into banners(placement, title, subtitle, cta_label, cta_url, is_active, sort_order) values
    ('hero', 'Play more. Pay smarter.', 'Instant game keys, verified accounts and top-ups in one premium store.', 'Browse products', '/products', true, 1),
    ('hero', 'Top up in seconds', 'Wallet or PromptPay. Every payment verified server-side.', 'Top up a game', '/topup', true, 2)`);
}
if (Number((await one("select count(*)::int as c from promotions")).c) === 0) {
  await q(`insert into promotions(title, subtitle, badge, cta_label, cta_url, is_active, sort_order) values
    ('Welcome offer', 'Use WELCOME10 for 10% off your first order over ฿200.', 'New customer', 'Shop now', '/products', true, 1),
    ('Steam wallet week', 'Top up your Steam wallet with instant codes.', 'Instant', 'Browse gift cards', '/categories/gift-cards', true, 2),
    ('Top-up marathon', 'Diamonds, UC and Genesis Crystals — delivered fast.', 'Popular', 'Open game top-up', '/topup', true, 3)`);
}
if (Number((await one("select count(*)::int as c from coupons where code = 'WELCOME10'")).c) === 0) {
  await q(`insert into coupons(code, description, type, value, min_order, max_discount, usage_limit, per_user_limit, is_active)
    values ('WELCOME10', '10% off your first order over ฿200', 'percentage', 10, 200, 100, 500, 1, true)`);
}
if (Number((await one("select count(*)::int as c from coupons where code = 'SAVE100'")).c) === 0) {
  await q(`insert into coupons(code, description, type, value, min_order, usage_limit, per_user_limit, is_active)
    values ('SAVE100', '฿100 off orders over ฿800', 'fixed', 100, 800, 200, 1, true)`);
}

// --------------------------------------------------------------- demo orders
const existingOrder = await one("select id from orders where user_id = $1 limit 1", [customer.id]);
if (!existingOrder) {
  // Starting wallet balance via a proper ledger deposit.
  let wallet = await one("select balance from wallets where user_id = $1", [customer.id]);
  if (!wallet) {
    await q("insert into wallets(user_id, balance) values ($1, 0) on conflict do nothing", [customer.id]);
    wallet = { balance: "0.00" };
  }
  const depositMinor = 150000;
  const ref = `DEMO-DEP-${Date.now()}`;
  const depPayment = await one(
    `insert into payments(reference, user_id, purpose, provider_id, amount, status, verification_source, paid_at, expires_at, metadata)
     values ($1,$2,'wallet_deposit','promptpay_qr','1500.00','PAID','manual', now(), now(), '{"demo":true}'::jsonb) returning id`,
    [ref, customer.id],
  );
  await q(
    `insert into wallet_transactions(user_id, type, amount, balance_after, reference, payment_id, description)
     values ($1,'deposit',$4,'1500.00',$2,$3,'Demo wallet top-up')`,
    [customer.id, ref, depPayment.id, "1500.00"],
  );
  await q("update wallets set balance = 1500.00 where user_id = $1", [customer.id]);

  const steamProduct = await one("select id, name_en, price, delivery_method from products where slug = 'steam-wallet-500'");
  const unit = await one("select id from product_inventory where product_id = $1 and status = 'AVAILABLE' limit 1", [steamProduct.id]);
  const numberRow = await one("select next_order_number() as n");
  const order = await one(
    `insert into orders(order_number, user_id, status, payment_status, delivery_status, subtotal, discount_total, total,
       payment_method, paid_at, completed_at)
     values ($1,$2,'completed','paid','delivered',$3,0,$3,'wallet', now(), now()) returning id`,
    [numberRow.n, customer.id, steamProduct.price],
  );
  const item = await one(
    `insert into order_items(order_id, product_id, product_name, product_slug, product_type, unit_price, quantity,
       subtotal, discount_total, total, delivery_method, fulfillment_status, delivered_at)
     values ($1,$2,$3,'steam-wallet-500','gift_card',$4,1,$4,0,$4,'auto','delivered', now()) returning id`,
    [order.id, steamProduct.id, steamProduct.name_en, steamProduct.price],
  );
  if (unit) {
    await q("update product_inventory set status = 'SOLD', order_item_id = $1, sold_at = now() where id = $2", [item.id, unit.id]);
    await q("update products set stock_quantity = greatest(0, stock_quantity - 1), sold_count = sold_count + 1 where id = $1", [steamProduct.id]);
  }
  const purchaseMinor = Math.round(Number(steamProduct.price) * 100);
  const afterPurchase = (depositMinor - purchaseMinor) / 100;
  await q(
    `insert into wallet_transactions(user_id, type, amount, balance_after, reference, order_id, description)
     values ($1,'purchase',$2,$3,$4,$5,'Payment for demo order')`,
    [customer.id, (-purchaseMinor / 100).toFixed(2), afterPurchase.toFixed(2), `DEMO-PAY-${order.id.slice(0, 8)}`, order.id],
  );
  await q("update wallets set balance = $2 where user_id = $1", [customer.id, afterPurchase.toFixed(2)]);

  await q(
    `insert into reviews(product_id, user_id, order_item_id, rating, title, body, status)
     values ($1,$2,$3,5,'Delivered instantly','Code arrived immediately and worked on the first try. Great service.', 'approved')`,
    [steamProduct.id, customer.id, item.id],
  );
  await q("select recalc_product_rating($1)", [steamProduct.id]);

  // A second, pending top-up order to exercise the manual fulfilment queue.
  const game = await one("select id, name from game_topup_games where slug = 'free-fire'");
  const pack = await one("select id, name, price from game_topup_products where game_id = $1 order by price asc limit 1", [game.id]);
  const number2 = await one("select next_order_number() as n");
  const topupOrder = await one(
    `insert into orders(order_number, user_id, status, payment_status, delivery_status, subtotal, discount_total, total,
       payment_method, paid_at)
     values ($1,$2,'processing','paid','processing',$3,0,$3,'wallet', now()) returning id`,
    [number2.n, customer.id, pack.price],
  );
  const topupItem = await one(
    `insert into order_items(order_id, product_id, product_name, product_type, unit_price, quantity, subtotal,
       discount_total, total, delivery_method, fulfillment_status, topup_fields, metadata)
     values ($1, null, $2, 'topup', $3, 1, $3, 0, $3, 'manual', 'pending', $4::jsonb, $5::jsonb) returning id`,
    [
      topupOrder.id,
      `${game.name} — ${pack.name}`,
      pack.price,
      JSON.stringify({ player_id: "123456789" }),
      JSON.stringify({ game_slug: game.slug, game_id: game.id, game_name: game.name, game_product_id: pack.id, package_name: pack.name }),
    ],
  );
  await q(
    `insert into game_topup_orders(order_id, order_item_id, user_id, game_product_id, game_name, package_name, player_fields, status)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,'PENDING')`,
    [topupOrder.id, topupItem.id, customer.id, pack.id, game.name, pack.name, JSON.stringify({ player_id: "123456789" })],
  );
  const topupMinor = Math.round(Number(pack.price) * 100);
  const finalBalance = (depositMinor - purchaseMinor - topupMinor) / 100;
  await q(
    `insert into wallet_transactions(user_id, type, amount, balance_after, reference, order_id, description)
     values ($1,'purchase',$2,$3,$4,$5,'Payment for demo top-up')`,
    [customer.id, (-topupMinor / 100).toFixed(2), finalBalance.toFixed(2), `DEMO-TOPUP-${topupOrder.id.slice(0, 8)}`, topupOrder.id],
  );
  await q("update wallets set balance = $2 where user_id = $1", [customer.id, finalBalance.toFixed(2)]);

  await q(`insert into notifications(user_id, type, title, body, link)
    values ($1,'purchase_completed','Your order is ready','Your Steam Wallet code is available in My Products.','/dashboard/products')`, [customer.id]);
  console.log("[seed] demo orders + review created");
}

console.log("");
console.log("================================================================");
console.log("  DEMO SEED COMPLETE");
console.log("  Admin:    " + adminEmail);
console.log("  Password: " + adminPassword);
console.log("  Customer: " + customerEmail + " / Demo1234!");
console.log("  Replace all demo products and inventory before going live.");
console.log("================================================================");
await close();
