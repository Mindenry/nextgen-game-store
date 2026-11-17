-- ============================================================================
-- Reference data (safe to run in production — no fabricated products/orders)
-- ============================================================================

insert into roles (id, name, description, is_system) values
  ('customer', 'Customer', 'Storefront customer', true),
  ('support', 'Support Staff', 'Customer support and ticket handling', true),
  ('finance', 'Finance', 'Payment verification, refunds and wallet adjustments', true),
  ('product_manager', 'Product Manager', 'Catalogue, inventory and top-up management', true),
  ('admin', 'Admin', 'Full store administration', true),
  ('super_admin', 'Super Admin', 'Unrestricted access including staff and settings', true)
on conflict (id) do update set name = excluded.name, description = excluded.description;

insert into permissions (id, category, description) values
  ('dashboard.view',    'admin',     'View admin dashboard'),
  ('analytics.view',    'admin',     'View sales analytics'),
  ('orders.view',       'orders',    'View orders'),
  ('orders.manage',     'orders',    'Update order status and fulfilment'),
  ('orders.refund',     'orders',    'Issue order refunds'),
  ('products.view',     'catalogue', 'View products'),
  ('products.manage',   'catalogue', 'Create, edit and delete products'),
  ('categories.manage', 'catalogue', 'Manage categories'),
  ('inventory.view',    'catalogue', 'View inventory items'),
  ('inventory.manage',  'catalogue', 'Add and edit inventory'),
  ('inventory.reveal',  'catalogue', 'Reveal encrypted inventory credentials'),
  ('topup.view',        'topup',     'View game top-up orders'),
  ('topup.manage',      'topup',     'Manage games and top-up packages'),
  ('topup.process',     'topup',     'Process game top-up orders'),
  ('payments.view',     'finance',   'View payments and webhook logs'),
  ('payments.verify',   'finance',   'Verify or reject manual payments'),
  ('payments.providers','finance',   'Configure payment providers'),
  ('wallet.adjust',     'finance',   'Adjust customer wallet balances'),
  ('customers.view',    'customers', 'View customer records'),
  ('customers.manage',  'customers', 'Suspend or reactivate customers'),
  ('coupons.manage',    'marketing', 'Manage coupons'),
  ('promotions.manage', 'marketing', 'Manage promotions and banners'),
  ('banners.manage',    'marketing', 'Manage homepage banners'),
  ('reviews.manage',    'content',   'Moderate product reviews'),
  ('support.view',      'support',   'View support tickets'),
  ('support.reply',     'support',   'Reply to support tickets'),
  ('notifications.manage','content', 'Send customer notifications'),
  ('staff.manage',      'admin',     'Manage staff accounts'),
  ('roles.manage',      'admin',     'Manage roles and permissions'),
  ('audit.view',        'admin',     'View audit logs'),
  ('settings.manage',   'admin',     'Change store settings')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id)
select 'super_admin', id from permissions
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select 'admin', id from permissions
where id not in ('staff.manage', 'roles.manage')
on conflict do nothing;

insert into role_permissions (role_id, permission_id) values
  ('finance', 'dashboard.view'), ('finance', 'analytics.view'),
  ('finance', 'orders.view'), ('finance', 'orders.refund'),
  ('finance', 'payments.view'), ('finance', 'payments.verify'),
  ('finance', 'wallet.adjust'), ('finance', 'customers.view'),
  ('finance', 'audit.view'),
  ('product_manager', 'dashboard.view'), ('product_manager', 'analytics.view'),
  ('product_manager', 'products.view'), ('product_manager', 'products.manage'),
  ('product_manager', 'categories.manage'), ('product_manager', 'inventory.view'),
  ('product_manager', 'inventory.manage'), ('product_manager', 'inventory.reveal'),
  ('product_manager', 'topup.view'), ('product_manager', 'topup.manage'),
  ('product_manager', 'orders.view'), ('product_manager', 'coupons.manage'),
  ('product_manager', 'promotions.manage'),
  ('support', 'dashboard.view'), ('support', 'orders.view'),
  ('support', 'customers.view'), ('support', 'support.view'),
  ('support', 'support.reply'), ('support', 'reviews.manage'),
  ('support', 'topup.view')
on conflict do nothing;

insert into categories (slug, name_th, name_en, description_th, description_en, icon, accent, sort_order) values
  ('game-accounts', 'ไอดีเกม', 'Game Accounts',
   'บัญชีเกมพร้อมเล่น ผ่านการตรวจสอบแล้ว', 'Verified, ready-to-play game accounts',
   'Gamepad2', 'violet', 1),
  ('game-topup', 'เติมเกม', 'Game Top-Up',
   'เติมเกมยอดนิยมทุกระบบ รับไอเทมไว', 'Instant top-up for popular games',
   'Zap', 'cyan', 2),
  ('steam-games', 'เกม Steam', 'Steam Games',
   'คีย์เกม Steam แท้ เปิดใช้งานได้ทันที', 'Genuine Steam keys, activate instantly',
   'MonitorPlay', 'sky', 3),
  ('minecraft', 'Minecraft', 'Minecraft Accounts',
   'บัญชี Minecraft หลากหลายแพ็กเกจ', 'Minecraft accounts for every playstyle',
   'Boxes', 'emerald', 4),
  ('roblox', 'Roblox', 'Roblox Products',
   'Robux, ไอดี และสินค้า Roblox', 'Robux, accounts and Roblox goods',
   'Blocks', 'rose', 5),
  ('mobile-games', 'เกมมือถือ', 'Mobile Games',
   'เติมเงินและไอเทมเกมมือถือ', 'Mobile game currency and items',
   'Smartphone', 'amber', 6),
  ('pc-games', 'เกม PC', 'PC Games',
   'เกม PC และคีย์ดิจิทัล', 'PC games and digital keys',
   'PcCase', 'indigo', 7),
  ('gift-cards', 'บัตรของขวัญ', 'Gift Cards',
   'บัตรของขวัญดิจิทัลหลากหลายแบรนด์', 'Digital gift cards for every platform',
   'Gift', 'fuchsia', 8),
  ('software-keys', 'ซอฟต์แวร์', 'Software & Digital Keys',
   'ไลเซนส์ซอฟต์แวร์และคีย์ดิจิทัล', 'Software licences and digital keys',
   'KeyRound', 'teal', 9),
  ('digital-services', 'บริการดิจิทัล', 'Other Digital Services',
   'บริการดิจิทัลและงานสั่งทำ', 'Digital services and custom work',
   'Sparkles', 'orange', 10)
on conflict (slug) do nothing;

insert into payment_providers (id, name, description, kind, is_enabled, config, sort_order) values
  ('promptpay_qr', 'PromptPay QR', 'PromptPay QR generated by the store. Automatic verification requires a provider webhook; otherwise slips are reviewed manually.', 'promptpay', true,
   '{"expiry_minutes": 15, "require_slip_upload": true}'::jsonb, 1),
  ('generic_webhook', 'External Payment Webhook', 'Connect any provider that can POST a signed webhook (HMAC-SHA256).', 'webhook', false,
   '{"header": "x-ngs-signature"}'::jsonb, 2),
  ('kbank', 'KBank Open API', 'KBank merchant API. Requires bank approval and credentials.', 'bank', false,
   '{"env": "sandbox"}'::jsonb, 3),
  ('manual', 'Manual Bank Transfer', 'Customer transfers and uploads a slip; staff verifies before funds are credited.', 'manual', true,
   '{}'::jsonb, 4)
on conflict (id) do nothing;

insert into game_topup_providers (id, name, adapter, is_enabled, config) values
  ('manual', 'Manual Fulfilment', 'manual', true, '{}'::jsonb)
on conflict (id) do nothing;

insert into system_settings (key, value) values
  ('site.name',        '"NEXTGEN GAME STORE"'::jsonb),
  ('site.tagline',     '"Premium digital games, top-ups and accounts."'::jsonb),
  ('site.description', '"NEXTGEN GAME STORE is a modern digital game marketplace: game accounts, Steam keys, gift cards and instant game top-ups with a secure wallet."'::jsonb),
  ('site.logo_url',    '""'::jsonb),
  ('site.favicon_url', '""'::jsonb),
  ('contact.email',    '"support@nextgen.local"'::jsonb),
  ('contact.phone',    '"+66 00 000 0000"'::jsonb),
  ('contact.address',  '"Bangkok, Thailand"'::jsonb),
  ('contact.hours',    '"Every day 09:00 – 24:00 (ICT)"'::jsonb),
  ('social.discord',   '""'::jsonb),
  ('social.facebook',  '""'::jsonb),
  ('social.instagram', '""'::jsonb),
  ('social.line',      '""'::jsonb),
  ('store.currency',   '"THB"'::jsonb),
  ('store.timezone',   '"Asia/Bangkok"'::jsonb),
  ('store.language',   '"th"'::jsonb),
  ('store.maintenance_mode', 'false'::jsonb),
  ('store.registration_open', 'true'::jsonb),
  ('payment.promptpay_id', '""'::jsonb),
  ('payment.receiver_name', '"NEXTGEN GAME STORE"'::jsonb),
  ('payment.min_deposit', '20'::jsonb),
  ('payment.max_deposit', '100000'::jsonb),
  ('payment.qr_expiry_minutes', '15'::jsonb),
  ('payment.active_provider', '"promptpay_qr"'::jsonb),
  ('footer.about', '"Digital goods delivered securely. Every order is tracked, every balance is backed by a ledger."'::jsonb),
  ('legal.terms', '"Terms and conditions placeholder. Replace with your store policy in Admin → Settings."'::jsonb),
  ('legal.privacy', '"Privacy policy placeholder. Replace with your store policy in Admin → Settings."'::jsonb),
  ('legal.refund', '"Refund policy placeholder. Replace with your store policy in Admin → Settings."'::jsonb)
on conflict (key) do nothing;
