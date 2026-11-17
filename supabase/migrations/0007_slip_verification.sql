-- Slip evidence integrity and third-party verification
alter table payments add column if not exists slip_hash text;
alter table payments add column if not exists slip_verification jsonb;

create unique index if not exists payments_slip_hash_key
  on payments(slip_hash) where slip_hash is not null;

alter table payments drop constraint if exists payments_verification_source_check;
alter table payments add constraint payments_verification_source_check
  check (verification_source in ('webhook','manual','wallet','reconcile','slip'));
