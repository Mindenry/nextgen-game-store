-- ============================================================================
-- Functions, triggers, views
-- ============================================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','categories','products','product_variants','coupons','orders',
    'payment_providers','payments','game_topup_providers','game_topup_games',
    'game_topup_products','game_topup_orders','reviews','support_tickets',
    'banners','promotions'
  ] loop
    execute format('drop trigger if exists %I on %I', t || '_set_updated_at', t);
    execute format(
      'create trigger %I before update on %I for each row execute function set_updated_at()',
      t || '_set_updated_at', t
    );
  end loop;
end $$;

create or replace function next_order_number()
returns text language sql volatile as $$
  select 'NGS-' || to_char(now() at time zone 'Asia/Bangkok', 'YYMMDD') || '-' ||
         lpad(nextval('order_number_seq')::text, 5, '0');
$$;

create or replace function next_ticket_number()
returns text language sql volatile as $$
  select 'NGT-' || to_char(now() at time zone 'Asia/Bangkok', 'YYMMDD') || '-' ||
         lpad(nextval('ticket_number_seq')::text, 5, '0');
$$;

create or replace function ensure_user_wallet()
returns trigger language plpgsql as $$
begin
  insert into wallets(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_create_wallet on profiles;
create trigger profiles_create_wallet
after insert on profiles
for each row execute function ensure_user_wallet();

create or replace function recalc_product_rating(p_product_id uuid)
returns void language sql as $$
  update products p
  set rating_avg = coalesce((
        select round(avg(r.rating)::numeric, 2) from reviews r
        where r.product_id = p.id and r.status = 'approved'
      ), 0),
      rating_count = (
        select count(*) from reviews r
        where r.product_id = p.id and r.status = 'approved'
      ),
      updated_at = now()
  where p.id = p_product_id;
$$;

-- Ledger integrity view: a wallet balance must always equal the ledger sum.
create or replace view v_wallet_reconciliation as
select w.user_id,
       w.balance,
       coalesce(sum(t.amount), 0)::numeric(12,2) as ledger_balance,
       (w.balance - coalesce(sum(t.amount), 0))::numeric(12,2) as drift
from wallets w
left join wallet_transactions t
  on t.user_id = w.user_id and t.status = 'completed'
group by w.user_id, w.balance;

-- Daily revenue series used by admin analytics.
create or replace view v_daily_revenue as
select (date_trunc('day', paid_at))::date as day,
       sum(total)::numeric(12,2) as revenue,
       count(*)::int as orders
from orders
where payment_status = 'paid' and paid_at is not null
group by 1;
