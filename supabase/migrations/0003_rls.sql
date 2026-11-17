-- ============================================================================
-- Row Level Security
-- The application server talks to Postgres with a privileged connection and
-- enforces authorization in server code. These policies protect any direct
-- access through the Supabase anon/authenticated roles (defence in depth).
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'roles','permissions','role_permissions','profiles','sessions','password_reset_tokens',
    'categories','products','product_variants','product_images','product_inventory','favorites',
    'coupons','orders','order_items','coupon_redemptions','payment_providers','payments',
    'payment_events','wallets','wallet_transactions','game_topup_providers','game_topup_games',
    'game_topup_products','game_topup_orders','reviews','support_tickets','support_messages',
    'notifications','banners','promotions','audit_logs','system_settings','idempotency_keys',
    'rate_limits'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Public catalogue -----------------------------------------------------------
grant select on categories, products, product_variants, product_images,
  game_topup_games, game_topup_products, banners, promotions to anon, authenticated;

drop policy if exists "public read categories" on categories;
create policy "public read categories" on categories
  for select to anon, authenticated using (is_active);

drop policy if exists "public read products" on products;
create policy "public read products" on products
  for select to anon, authenticated using (is_active);

drop policy if exists "public read variants" on product_variants;
create policy "public read variants" on product_variants
  for select to anon, authenticated using (is_active);

drop policy if exists "public read images" on product_images;
create policy "public read images" on product_images
  for select to anon, authenticated using (true);

drop policy if exists "public read approved reviews" on reviews;
create policy "public read approved reviews" on reviews
  for select to anon, authenticated using (status = 'approved');
grant select (id, product_id, user_id, rating, title, body, created_at) on reviews
  to anon, authenticated;

drop policy if exists "public read active games" on game_topup_games;
create policy "public read active games" on game_topup_games
  for select to anon, authenticated using (is_active);

drop policy if exists "public read active topup products" on game_topup_products;
create policy "public read active topup products" on game_topup_products
  for select to anon, authenticated using (is_active);

drop policy if exists "public read banners" on banners;
create policy "public read banners" on banners
  for select to anon, authenticated using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

drop policy if exists "public read promotions" on promotions;
create policy "public read promotions" on promotions
  for select to anon, authenticated using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

-- Own profile ----------------------------------------------------------------
grant select on profiles to authenticated;
grant update (display_name, username, avatar_url, phone) on profiles to authenticated;

drop policy if exists "own profile read" on profiles;
create policy "own profile read" on profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "own profile update" on profiles;
create policy "own profile update" on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Own wallet ---------------------------------------------------------------
grant select on wallets, wallet_transactions to authenticated;

drop policy if exists "own wallet read" on wallets;
create policy "own wallet read" on wallets
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "own ledger read" on wallet_transactions;
create policy "own ledger read" on wallet_transactions
  for select to authenticated using (user_id = auth.uid());

-- Own orders and payments ----------------------------------------------------
grant select on orders, order_items, payments to authenticated;

drop policy if exists "own orders read" on orders;
create policy "own orders read" on orders
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "own order items read" on order_items;
create policy "own order items read" on order_items
  for select to authenticated using (
    exists (select 1 from orders o where o.id = order_items.order_id and o.user_id = auth.uid())
  );

drop policy if exists "own payments read" on payments;
create policy "own payments read" on payments
  for select to authenticated using (user_id = auth.uid());

grant select (id, order_id, user_id, game_name, package_name, player_fields, status,
  processed_at, created_at) on game_topup_orders to authenticated;

drop policy if exists "own topup read" on game_topup_orders;
create policy "own topup read" on game_topup_orders
  for select to authenticated using (user_id = auth.uid());

-- Notifications --------------------------------------------------------------
grant select on notifications to authenticated;
grant update (read_at) on notifications to authenticated;

drop policy if exists "own notifications read" on notifications;
create policy "own notifications read" on notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "own notifications update" on notifications;
create policy "own notifications update" on notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Favourites -----------------------------------------------------------------
grant select, insert, delete on favorites to authenticated;

drop policy if exists "own favorites read" on favorites;
create policy "own favorites read" on favorites
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "own favorites insert" on favorites;
create policy "own favorites insert" on favorites
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "own favorites delete" on favorites;
create policy "own favorites delete" on favorites
  for delete to authenticated using (user_id = auth.uid());

-- Support --------------------------------------------------------------------
grant select on support_tickets, support_messages to authenticated;

drop policy if exists "own tickets read" on support_tickets;
create policy "own tickets read" on support_tickets
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "own ticket messages read" on support_messages;
create policy "own ticket messages read" on support_messages
  for select to authenticated using (
    is_internal = false
    and exists (
      select 1 from support_tickets t
      where t.id = support_messages.ticket_id and t.user_id = auth.uid()
    )
  );

-- Everything else (roles, coupons, inventory, audit logs, settings, sessions,
-- payment events, provider secrets, rate limits) is intentionally unreachable
-- with anon/authenticated keys. Server code uses the privileged connection.
