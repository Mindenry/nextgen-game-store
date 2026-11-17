-- Demo/test-only auto-credit for self-parsed slip QRs (capped at 1 THB in code,
-- never active when NODE_ENV=production).
alter table payments drop constraint if exists payments_verification_source_check;
alter table payments add constraint payments_verification_source_check
  check (verification_source in ('webhook','manual','wallet','reconcile','slip','self_test'));

insert into system_settings (key, value) values
  ('slip.self_auto_credit', 'false'::jsonb)
on conflict (key) do nothing;
