-- Self-hosted slip pre-check + TrueMoney Angpao (manual redemption)
alter table payments add column if not exists slip_bank_ref text;
create unique index if not exists payments_slip_bank_ref_key
  on payments(slip_bank_ref) where slip_bank_ref is not null;

alter table payments add column if not exists voucher_hash text;
create unique index if not exists payments_voucher_hash_key
  on payments(voucher_hash) where voucher_hash is not null;
alter table payments add column if not exists voucher_url_encrypted text;

insert into payment_providers (id, name, description, kind, is_enabled, config, sort_order)
values (
  'truemoney_angpao',
  'TrueMoney Angpao (Manual)',
  'รับซองอั่งเปา TrueMoney เข้าเบอร์ร้าน / ลูกค้าวางลิงก์ซอง แอดมินเป็นผู้ redeem ในแอป TrueMoney แล้วอนุมัติ',
  'manual',
  true,
  '{"instructions":"ส่งซองอั่งเปา TrueMoney มาที่เบอร์ 0812345678 แล้ววางลิงก์ซองอั่งเปาในช่องด้านล่าง เจ้าหน้าที่จะ redeem และอนุมัติยอดให้"}'::jsonb,
  5
)
on conflict (id) do nothing;

insert into system_settings (key, value) values
  ('truemoney.phone', '"0812345678"'::jsonb)
on conflict (key) do nothing;
