-- ============================================================================
-- NEXTGEN GAME STORE — Core schema
-- Portable PostgreSQL (Supabase + embedded PGlite for local development)
-- Money is NUMERIC(12,2) everywhere. Never floating point.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Identity, roles, permissions
-- ---------------------------------------------------------------------------
create table if not exists roles (
  id           text primary key,
  name         text not null,
  description  text,
  is_system    boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists permissions (
  id           text primary key,
  category     text not null default 'general',
  description  text not null
);

create table if not exists role_permissions (
  role_id       text not null references roles(id) on delete cascade,
  permission_id text not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists profiles (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  email_lower       text generated always as (lower(email)) stored,
  email_verified_at timestamptz,
  password_hash     text,
  username          text,
  display_name      text not null default 'Player',
  avatar_url        text,
  phone             text,
  role_id           text not null default 'customer' references roles(id),
  status            text not null default 'active'
                    check (status in ('active', 'suspended', 'deleted')),
  last_login_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists profiles_email_lower_key on profiles(email_lower);
create unique index if not exists profiles_username_lower_key on profiles(lower(username))
  where username is not null;
create index if not exists profiles_role_idx on profiles(role_id);
create index if not exists profiles_created_idx on profiles(created_at desc);

create table if not exists sessions (
  id           text primary key,
  user_id      uuid not null references profiles(id) on delete cascade,
  token_hash   text not null unique,
  ip           text,
  user_agent   text,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);
create index if not exists sessions_user_idx on sessions(user_id);
create index if not exists sessions_expires_idx on sessions(expires_at);

create table if not exists password_reset_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  token_hash  text not null unique,
  kind        text not null default 'reset' check (kind in ('reset', 'verify')),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists password_reset_user_idx on password_reset_tokens(user_id);

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table if not exists categories (
  id             uuid primary key default gen_random_uuid(),
  parent_id      uuid references categories(id) on delete set null,
  slug           text not null unique,
  name_th        text not null,
  name_en        text not null,
  description_th text,
  description_en text,
  icon           text not null default 'Gamepad2',
  accent         text not null default 'violet',
  image_url      text,
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists categories_parent_idx on categories(parent_id, sort_order);

create table if not exists products (
  id                uuid primary key default gen_random_uuid(),
  category_id       uuid not null references categories(id) on delete restrict,
  slug              text not null unique,
  name_th           text not null,
  name_en           text not null,
  short_description text,
  description       text,
  product_type      text not null default 'digital_key'
                    check (product_type in ('game_account','digital_key','topup','gift_card','service')),
  price             numeric(12,2) not null check (price >= 0),
  compare_at_price  numeric(12,2) check (compare_at_price is null or compare_at_price >= 0),
  cost_price        numeric(12,2) check (cost_price is null or cost_price >= 0),
  currency          text not null default 'THB' check (currency = 'THB'),
  stock_mode        text not null default 'inventory'
                    check (stock_mode in ('inventory','unlimited','manual')),
  stock_quantity    integer not null default 0 check (stock_quantity >= 0),
  sold_count        integer not null default 0 check (sold_count >= 0),
  badge             text,
  is_active         boolean not null default true,
  is_featured       boolean not null default false,
  delivery_method   text not null default 'auto' check (delivery_method in ('auto','manual')),
  delivery_time     text not null default 'Instant',
  terms             text,
  rating_avg        numeric(3,2) not null default 0 check (rating_avg >= 0 and rating_avg <= 5),
  rating_count      integer not null default 0,
  sort_order        integer not null default 0,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists products_category_idx on products(category_id, is_active);
create index if not exists products_featured_idx on products(is_featured, created_at desc)
  where is_active;
create index if not exists products_created_idx on products(created_at desc) where is_active;
create index if not exists products_sold_idx on products(sold_count desc) where is_active;
create index if not exists products_type_idx on products(product_type, is_active);
create index if not exists products_search_idx on products(lower(name_en), lower(name_th));
create index if not exists products_metadata_idx on products using gin(metadata);

create table if not exists product_variants (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references products(id) on delete cascade,
  name_th          text not null,
  name_en          text not null,
  sku              text unique,
  price            numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2),
  stock_quantity   integer not null default 0 check (stock_quantity >= 0),
  is_active        boolean not null default true,
  sort_order       integer not null default 0,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists product_variants_product_idx on product_variants(product_id, sort_order);

create table if not exists product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url        text not null,
  alt        text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_images_product_idx on product_images(product_id, sort_order);

create table if not exists product_inventory (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references products(id) on delete cascade,
  variant_id       uuid references product_variants(id) on delete set null,
  encrypted_payload text not null,
  payload_hint     text,
  status           text not null default 'AVAILABLE'
                   check (status in ('AVAILABLE','RESERVED','SOLD','DISABLED')),
  order_item_id    uuid,
  reserved_until   timestamptz,
  created_at       timestamptz not null default now(),
  sold_at          timestamptz
);
create index if not exists product_inventory_available_idx
  on product_inventory(product_id, status, created_at);
create unique index if not exists product_inventory_order_item_key
  on product_inventory(order_item_id) where order_item_id is not null;

create table if not exists favorites (
  user_id    uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Orders and payments
-- ---------------------------------------------------------------------------
create sequence if not exists order_number_seq;
create sequence if not exists ticket_number_seq;

create table if not exists coupons (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  description       text,
  type              text not null check (type in ('percentage','fixed')),
  value             numeric(12,2) not null check (value > 0),
  min_order         numeric(12,2) not null default 0 check (min_order >= 0),
  max_discount      numeric(12,2) check (max_discount is null or max_discount > 0),
  starts_at         timestamptz,
  expires_at        timestamptz,
  usage_limit       integer check (usage_limit is null or usage_limit > 0),
  per_user_limit    integer not null default 1 check (per_user_limit > 0),
  used_count        integer not null default 0 check (used_count >= 0),
  applies_to        jsonb not null default '{}'::jsonb,
  first_purchase_only boolean not null default false,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists coupons_active_idx on coupons(is_active, expires_at);

create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    text not null unique,
  user_id         uuid not null references profiles(id) on delete restrict,
  status          text not null default 'pending_payment'
                  check (status in ('pending_payment','paid','processing','completed','cancelled','refunded')),
  payment_status  text not null default 'unpaid'
                  check (payment_status in ('unpaid','pending','paid','failed','refunded')),
  delivery_status text not null default 'pending'
                  check (delivery_status in ('pending','processing','delivered','failed')),
  subtotal        numeric(12,2) not null default 0 check (subtotal >= 0),
  discount_total  numeric(12,2) not null default 0 check (discount_total >= 0),
  total           numeric(12,2) not null default 0 check (total >= 0),
  currency        text not null default 'THB' check (currency = 'THB'),
  coupon_id       uuid references coupons(id) on delete set null,
  coupon_code     text,
  payment_method  text,
  customer_note   text,
  internal_note   text,
  paid_at         timestamptz,
  completed_at    timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists orders_user_idx on orders(user_id, created_at desc);
create index if not exists orders_status_idx on orders(status, created_at desc);
create index if not exists orders_payment_status_idx on orders(payment_status, created_at desc);

create table if not exists order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references orders(id) on delete cascade,
  product_id       uuid references products(id) on delete set null,
  variant_id       uuid references product_variants(id) on delete set null,
  product_name     text not null,
  product_slug     text,
  product_type     text not null,
  image_url        text,
  unit_price       numeric(12,2) not null check (unit_price >= 0),
  quantity         integer not null check (quantity > 0),
  subtotal         numeric(12,2) not null check (subtotal >= 0),
  discount_total   numeric(12,2) not null default 0,
  total            numeric(12,2) not null check (total >= 0),
  delivery_method  text not null default 'auto' check (delivery_method in ('auto','manual')),
  fulfillment_status text not null default 'pending'
                   check (fulfillment_status in ('pending','reserved','delivered','failed','refunded')),
  topup_fields     jsonb,
  delivered_at     timestamptz,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists order_items_order_idx on order_items(order_id);
create index if not exists order_items_product_idx on order_items(product_id);

create table if not exists coupon_redemptions (
  id              uuid primary key default gen_random_uuid(),
  coupon_id       uuid not null references coupons(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  order_id        uuid not null references orders(id) on delete cascade,
  discount_amount numeric(12,2) not null check (discount_amount >= 0),
  created_at      timestamptz not null default now(),
  unique (coupon_id, order_id)
);
create index if not exists coupon_redemptions_user_idx on coupon_redemptions(user_id, coupon_id);

create table if not exists payment_providers (
  id               text primary key,
  name             text not null,
  description      text,
  kind             text not null default 'promptpay'
                   check (kind in ('promptpay','bank','webhook','manual')),
  is_enabled       boolean not null default false,
  config           jsonb not null default '{}'::jsonb,
  secret_encrypted text,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists payments (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null unique,
  user_id           uuid not null references profiles(id) on delete restrict,
  order_id          uuid references orders(id) on delete set null,
  purpose           text not null check (purpose in ('wallet_deposit','order')),
  provider_id       text not null references payment_providers(id),
  amount            numeric(12,2) not null check (amount > 0),
  currency          text not null default 'THB' check (currency = 'THB'),
  status            text not null default 'PENDING'
                    check (status in ('PENDING','VERIFYING','PAID','EXPIRED','FAILED','REJECTED','MANUAL_REVIEW','REFUNDED')),
  qr_payload        text,
  provider_ref      text,
  verification_source text check (verification_source in ('webhook','manual','wallet','reconcile')),
  evidence_url      text,
  reviewer_id       uuid references profiles(id) on delete set null,
  review_note       text,
  reviewed_at       timestamptz,
  expires_at        timestamptz not null,
  paid_at           timestamptz,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists payments_user_idx on payments(user_id, created_at desc);
create index if not exists payments_status_idx on payments(status, created_at desc);
create index if not exists payments_order_idx on payments(order_id);
create unique index if not exists payments_provider_ref_key
  on payments(provider_id, provider_ref) where provider_ref is not null;

create table if not exists payment_events (
  id              uuid primary key default gen_random_uuid(),
  payment_id      uuid references payments(id) on delete set null,
  provider_id     text not null,
  event_type      text not null,
  provider_ref    text,
  payload         jsonb not null default '{}'::jsonb,
  signature_valid boolean not null default false,
  ip              text,
  created_at      timestamptz not null default now()
);
create index if not exists payment_events_payment_idx on payment_events(payment_id, created_at desc);
create index if not exists payment_events_created_idx on payment_events(created_at desc);

-- ---------------------------------------------------------------------------
-- Wallet ledger
-- ---------------------------------------------------------------------------
create table if not exists wallets (
  user_id    uuid primary key references profiles(id) on delete cascade,
  balance    numeric(12,2) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists wallet_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete restrict,
  type          text not null
                check (type in ('deposit','purchase','refund','admin_credit','admin_debit','reversal')),
  amount        numeric(12,2) not null check (amount <> 0),
  balance_after numeric(12,2) not null check (balance_after >= 0),
  reference     text not null unique,
  status        text not null default 'completed' check (status in ('completed','reversed')),
  payment_id    uuid references payments(id) on delete set null,
  order_id      uuid references orders(id) on delete set null,
  admin_id      uuid references profiles(id) on delete set null,
  description   text not null,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists wallet_transactions_user_idx on wallet_transactions(user_id, created_at desc);
create index if not exists wallet_transactions_type_idx on wallet_transactions(type, created_at desc);

-- ---------------------------------------------------------------------------
-- Game top-up
-- ---------------------------------------------------------------------------
create table if not exists game_topup_providers (
  id         text primary key,
  name       text not null,
  adapter    text not null default 'manual',
  is_enabled boolean not null default false,
  config     jsonb not null default '{}'::jsonb,
  secret_encrypted text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists game_topup_games (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  logo_url   text,
  banner_url text,
  fields     jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists game_topup_products (
  id               uuid primary key default gen_random_uuid(),
  game_id          uuid not null references game_topup_games(id) on delete cascade,
  slug             text not null unique,
  name             text not null,
  sku              text,
  price            numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2),
  provider_id      text references game_topup_providers(id) on delete set null,
  delivery_type    text not null default 'manual' check (delivery_type in ('auto','manual')),
  is_active        boolean not null default true,
  sort_order       integer not null default 0,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists game_topup_products_game_idx on game_topup_products(game_id, sort_order);

create table if not exists game_topup_orders (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  order_item_id   uuid not null references order_items(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete restrict,
  game_product_id uuid references game_topup_products(id) on delete set null,
  game_name       text not null,
  package_name    text not null,
  player_fields   jsonb not null default '{}'::jsonb,
  status          text not null default 'PENDING'
                  check (status in ('PENDING','PROCESSING','COMPLETED','FAILED','REFUNDED','MANUAL_REVIEW')),
  provider_ref    text,
  processed_by    uuid references profiles(id) on delete set null,
  processed_at    timestamptz,
  failure_reason  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists game_topup_orders_status_idx on game_topup_orders(status, created_at desc);
create index if not exists game_topup_orders_user_idx on game_topup_orders(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Engagement
-- ---------------------------------------------------------------------------
create table if not exists reviews (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  order_item_id uuid not null references order_items(id) on delete cascade,
  rating        integer not null check (rating between 1 and 5),
  title         text,
  body          text,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (order_item_id)
);
create index if not exists reviews_product_idx on reviews(product_id, status, created_at desc);
create index if not exists reviews_status_idx on reviews(status, created_at desc);

create table if not exists support_tickets (
  id            uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  user_id       uuid not null references profiles(id) on delete cascade,
  subject       text not null,
  category      text not null default 'general',
  priority      text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status        text not null default 'open' check (status in ('open','pending','resolved','closed')),
  assigned_to   uuid references profiles(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists support_tickets_user_idx on support_tickets(user_id, created_at desc);
create index if not exists support_tickets_status_idx on support_tickets(status, last_message_at desc);

create table if not exists support_messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references support_tickets(id) on delete cascade,
  author_id  uuid references profiles(id) on delete set null,
  body       text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_ticket_idx on support_messages(ticket_id, created_at);

create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications(user_id, read_at, created_at desc);

create table if not exists banners (
  id         uuid primary key default gen_random_uuid(),
  placement  text not null default 'hero' check (placement in ('hero','promo','announcement')),
  title      text not null,
  subtitle   text,
  image_url  text,
  cta_label  text,
  cta_url    text,
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists banners_placement_idx on banners(placement, is_active, sort_order);

create table if not exists promotions (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  subtitle   text,
  image_url  text,
  cta_label  text,
  cta_url    text,
  badge      text,
  is_active  boolean not null default true,
  starts_at  timestamptz,
  ends_at    timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Platform
-- ---------------------------------------------------------------------------
create table if not exists audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles(id) on delete set null,
  actor_email text,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on audit_logs(created_at desc);
create index if not exists audit_logs_entity_idx on audit_logs(entity_type, entity_id);

create table if not exists system_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists idempotency_keys (
  key        text primary key,
  scope      text not null,
  user_id    uuid references profiles(id) on delete cascade,
  response   jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists idempotency_expires_idx on idempotency_keys(expires_at);

create table if not exists rate_limits (
  bucket     text primary key,
  count      integer not null default 0,
  reset_at   timestamptz not null
);
create index if not exists rate_limits_reset_idx on rate_limits(reset_at);
