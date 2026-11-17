-- Real payment reconciliation against the merchant's own bank statement.
-- A slip image alone can never be verified for free; the bank statement is the
-- authoritative source that the money actually arrived.

create table if not exists bank_statement_imports (
  id            uuid primary key default gen_random_uuid(),
  bank          text not null default 'generic',
  file_name     text,
  row_count     int not null default 0,
  import_count  int not null default 0,
  matched_count int not null default 0,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table if not exists bank_transactions (
  id            uuid primary key default gen_random_uuid(),
  source        text not null default 'csv' check (source in ('csv', 'email', 'manual')),
  bank          text,
  external_id   text not null,
  direction     text not null default 'credit' check (direction in ('credit', 'debit')),
  amount        numeric(12,2) not null check (amount > 0),
  occurred_at   timestamptz not null,
  description   text,
  counterparty  text,
  slip_reference text,
  import_id     uuid references bank_statement_imports(id) on delete set null,
  payment_id    uuid references payments(id) on delete set null,
  match_method  text,
  matched_at    timestamptz,
  matched_by    uuid references profiles(id) on delete set null,
  raw           text,
  created_at    timestamptz not null default now(),
  unique (source, external_id)
);

create index if not exists bank_transactions_occurred_idx on bank_transactions(occurred_at desc);
create index if not exists bank_transactions_unmatched_idx on bank_transactions(payment_id) where payment_id is null;
create index if not exists bank_transactions_payment_idx on bank_transactions(payment_id) where payment_id is not null;
-- One payment can be settled by at most one bank credit.
create unique index if not exists bank_transactions_payment_unique on bank_transactions(payment_id)
  where payment_id is not null;

insert into system_settings (key, value) values
  ('bank.auto_match_enabled', 'true'::jsonb),
  ('bank.match_window_minutes', '1440'::jsonb)
on conflict (key) do nothing;

-- The old demo switch must never credit money from an image again.
update system_settings set value = 'false'::jsonb, updated_at = now()
where key = 'slip.self_auto_credit';
