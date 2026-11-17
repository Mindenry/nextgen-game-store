import "server-only";
import { many, one } from "@/lib/db";
import { formatTHB, toMinor } from "@/lib/money";

export async function adminStats() {
  const row = await one<{
    revenue: string;
    orders: number;
    customers: number;
    products: number;
    deposits: string;
    pending_payments: number;
    pending_orders: number;
    completed_orders: number;
    failed_payments: number;
  }>(
    `select
       coalesce((select sum(total) from orders where payment_status = 'paid'), 0) as revenue,
       (select count(*)::int from orders) as orders,
       (select count(*)::int from profiles where role_id = 'customer') as customers,
       (select count(*)::int from products where is_active) as products,
       coalesce((select sum(amount) from payments where purpose = 'wallet_deposit' and status = 'PAID'), 0) as deposits,
       (select count(*)::int from payments where status in ('PENDING','MANUAL_REVIEW','VERIFYING')) as pending_payments,
       (select count(*)::int from orders where status in ('paid','processing')) as pending_orders,
       (select count(*)::int from orders where status = 'completed') as completed_orders,
       (select count(*)::int from payments where status in ('FAILED','REJECTED')) as failed_payments`,
  );

  const [bestSellers, recentOrders, series] = await Promise.all([
    many<{ id: string; name_en: string; slug: string; sold_count: number; price: string; image_url: string | null }>(
      `select p.id, p.name_en, p.slug, p.sold_count, p.price,
              (select url from product_images pi where pi.product_id = p.id limit 1) as image_url
       from products p order by p.sold_count desc limit 5`,
    ),
    many<{
      id: string;
      order_number: string;
      total: string;
      status: string;
      payment_status: string;
      created_at: string;
      email: string;
      display_name: string;
    }>(
      `select o.id, o.order_number, o.total, o.status, o.payment_status, o.created_at, p.email, p.display_name
       from orders o join profiles p on p.id = o.user_id order by o.created_at desc limit 8`,
    ),
    many<{ day: string; revenue: string; orders: number }>(
      `select day::text, revenue, orders from v_daily_revenue where day >= current_date - interval '13 days' order by day`,
    ),
  ]);

  const revenue = toMinor(row?.revenue ?? "0");
  const orders = Number(row?.orders ?? 0);
  const paidOrders = await one<{ count: number }>(
    "select count(*)::int as count from orders where payment_status = 'paid'",
  );

  return {
    revenueMinor: revenue,
    revenue: row?.revenue ?? "0",
    orders,
    paidOrders: Number(paidOrders?.count ?? 0),
    customers: Number(row?.customers ?? 0),
    products: Number(row?.products ?? 0),
    deposits: row?.deposits ?? "0",
    pendingPayments: Number(row?.pending_payments ?? 0),
    pendingOrders: Number(row?.pending_orders ?? 0),
    completedOrders: Number(row?.completed_orders ?? 0),
    failedPayments: Number(row?.failed_payments ?? 0),
    averageOrder: paidOrders?.count ? formatTHB(revenue / 100 / Number(paidOrders.count)) : formatTHB(0),
    bestSellers,
    recentOrders,
    series,
  };
}

export async function listAdminOrders(input: { q?: string; status?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, input.pageSize ?? 20);
  const values: unknown[] = [];
  const where: string[] = ["1=1"];
  if (input.q?.trim()) {
    values.push(`%${input.q.trim()}%`);
    where.push(`(o.order_number ilike $${values.length} or p.email ilike $${values.length} or p.display_name ilike $${values.length})`);
  }
  if (input.status) {
    values.push(input.status);
    where.push(`o.status = $${values.length}`);
  }
  const count = await one<{ count: number }>(
    `select count(*)::int as count from orders o join profiles p on p.id = o.user_id where ${where.join(" and ")}`,
    values,
  );
  values.push(pageSize, (page - 1) * pageSize);
  const rows = await many<{
    id: string;
    order_number: string;
    total: string;
    status: string;
    payment_status: string;
    delivery_status: string;
    created_at: string;
    email: string;
    display_name: string;
    item_count: number;
  }>(
    `select o.id, o.order_number, o.total, o.status, o.payment_status, o.delivery_status, o.created_at,
            p.email, p.display_name,
            (select coalesce(sum(quantity),0)::int from order_items oi where oi.order_id = o.id) as item_count
     from orders o join profiles p on p.id = o.user_id
     where ${where.join(" and ")} order by o.created_at desc limit $${values.length - 1} offset $${values.length}`,
    values,
  );
  return { rows, total: Number(count?.count ?? 0), page, pageSize };
}

export async function getAdminOrder(id: string) {
  const order = await one<{
    id: string;
    order_number: string;
    user_id: string;
    status: string;
    payment_status: string;
    delivery_status: string;
    subtotal: string;
    discount_total: string;
    total: string;
    coupon_code: string | null;
    payment_method: string | null;
    customer_note: string | null;
    internal_note: string | null;
    created_at: string;
    paid_at: string | null;
    completed_at: string | null;
    email: string;
    display_name: string;
    username: string | null;
  }>(
    `select o.*, p.email, p.display_name, p.username from orders o join profiles p on p.id = o.user_id
     where o.id::text = $1 or o.order_number = $1`,
    [id],
  );
  if (!order) return null;
  const [items, payments, topups, audits] = await Promise.all([
    many<{
      id: string;
      product_id: string | null;
      product_name: string;
      product_slug: string | null;
      product_type: string;
      unit_price: string;
      quantity: number;
      total: string;
      delivery_method: string;
      fulfillment_status: string;
      topup_fields: Record<string, string> | null;
      delivery_note: string | null;
      delivered_at: string | null;
      has_payload: boolean;
    }>(
      `select id, product_id, product_name, product_slug, product_type, unit_price, quantity, total,
              delivery_method, fulfillment_status, topup_fields, delivery_note, delivered_at,
              (delivery_payload_encrypted is not null) as has_payload
       from order_items where order_id = $1 order by created_at`,
      [order.id],
    ),
    many<{ id: string; reference: string; amount: string; status: string; provider_id: string; created_at: string; evidence_url: string | null }>(
      "select id, reference, amount, status, provider_id, created_at, evidence_url from payments where order_id = $1 order by created_at desc",
      [order.id],
    ),
    many<{ id: string; order_item_id: string; game_name: string; package_name: string; player_fields: Record<string, string>; status: string; failure_reason: string | null; created_at: string }>(
      "select id, order_item_id, game_name, package_name, player_fields, status, failure_reason, created_at from game_topup_orders where order_id = $1",
      [order.id],
    ),
    many<{ id: string; action: string; actor_email: string | null; created_at: string; after: unknown }>(
      "select id, action, actor_email, created_at, after from audit_logs where entity_type in ('order','order_item','payment') and (entity_id = $1 or after::text like $2) order by created_at desc limit 20",
      [order.id, `%${order.id}%`],
    ),
  ]);
  return { order, items, payments, topups, audits };
}

export async function listPayments(input: { q?: string; status?: string; page?: number; purpose?: string }) {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = 20;
  const values: unknown[] = [];
  const where: string[] = ["1=1"];
  if (input.q?.trim()) {
    values.push(`%${input.q.trim()}%`);
    where.push(`(pm.reference ilike $${values.length} or p.email ilike $${values.length} or o.order_number ilike $${values.length})`);
  }
  if (input.status) {
    values.push(input.status);
    where.push(`pm.status = $${values.length}`);
  }
  if (input.purpose) {
    values.push(input.purpose);
    where.push(`pm.purpose = $${values.length}`);
  }
  const count = await one<{ count: number }>(
    `select count(*)::int as count from payments pm join profiles p on p.id = pm.user_id
     left join orders o on o.id = pm.order_id where ${where.join(" and ")}`,
    values,
  );
  values.push(pageSize, (page - 1) * pageSize);
  const rows = await many<{
    id: string;
    reference: string;
    amount: string;
    status: string;
    purpose: string;
    provider_id: string;
    created_at: string;
    expires_at: string;
    evidence_url: string | null;
    email: string;
    display_name: string;
    order_number: string | null;
    reviewed_at: string | null;
    review_note: string | null;
    verification_source: string | null;
    slip_hash: string | null;
    slip_bank_ref: string | null;
    slip_verification: Record<string, unknown> | null;
    voucher_hash: string | null;
    voucher_url_encrypted: string | null;
  }>(
    `select pm.id, pm.reference, pm.amount, pm.status, pm.purpose, pm.provider_id, pm.created_at,
            pm.expires_at, pm.evidence_url, p.email, p.display_name, o.order_number,
            pm.reviewed_at, pm.review_note, pm.verification_source, pm.slip_hash, pm.slip_bank_ref, pm.slip_verification, pm.voucher_hash, pm.voucher_url_encrypted
     from payments pm join profiles p on p.id = pm.user_id
     left join orders o on o.id = pm.order_id
     where ${where.join(" and ")} order by pm.created_at desc limit $${values.length - 1} offset $${values.length}`,
    values,
  );
  const totals = await one<{ pending: number; review: number; paid_today: string }>(
    `select
       (select count(*)::int from payments where status = 'PENDING') as pending,
       (select count(*)::int from payments where status = 'MANUAL_REVIEW') as review,
       coalesce((select sum(amount) from payments where status = 'PAID' and paid_at::date = current_date), 0) as paid_today`,
  );
  return { rows, total: Number(count?.count ?? 0), page, pageSize, totals };
}

export async function listPaymentProviders() {
  return many<{
    id: string;
    name: string;
    description: string | null;
    kind: string;
    is_enabled: boolean;
    config: Record<string, unknown>;
    secret_set: boolean;
    sort_order: number;
  }>(
    `select id, name, description, kind, is_enabled, config, (secret_encrypted is not null) as secret_set, sort_order
     from payment_providers order by sort_order`,
  );
}

export async function listWebhookEvents(limit = 50) {
  return many<{
    id: string;
    provider_id: string;
    event_type: string;
    provider_ref: string | null;
    signature_valid: boolean;
    ip: string | null;
    created_at: string;
    reference: string | null;
  }>(
    `select e.id, e.provider_id, e.event_type, e.provider_ref, e.signature_valid, e.ip, e.created_at,
            pm.reference
     from payment_events e left join payments pm on pm.id = e.payment_id
     order by e.created_at desc limit $1`,
    [limit],
  );
}

export async function listCustomers(q?: string, page = 1) {
  const pageSize = 20;
  const values: unknown[] = [];
  let where = "1=1";
  if (q?.trim()) {
    values.push(`%${q.trim()}%`);
    where = `(p.email ilike $1 or p.display_name ilike $1 or coalesce(p.username,'') ilike $1)`;
  }
  const count = await one<{ count: number }>(`select count(*)::int as count from profiles p where ${where}`, values);
  values.push(pageSize, (page - 1) * pageSize);
  const rows = await many<{
    id: string;
    email: string;
    display_name: string;
    username: string | null;
    role_id: string;
    status: string;
    created_at: string;
    last_login_at: string | null;
    wallet_balance: string;
    order_count: number;
    total_spent: string;
  }>(
    `select p.id, p.email, p.display_name, p.username, p.role_id, p.status, p.created_at, p.last_login_at,
            coalesce(w.balance, 0) as wallet_balance,
            (select count(*)::int from orders o where o.user_id = p.id) as order_count,
            coalesce((select sum(total) from orders o where o.user_id = p.id and o.payment_status = 'paid'), 0) as total_spent
     from profiles p left join wallets w on w.user_id = p.id
     where ${where} order by p.created_at desc limit $${values.length - 1} offset $${values.length}`,
    values,
  );
  return { rows, total: Number(count?.count ?? 0), page, pageSize };
}

export async function getCustomerDetail(id: string) {
  const customer = await one<{
    id: string;
    email: string;
    display_name: string;
    username: string | null;
    phone: string | null;
    role_id: string;
    status: string;
    created_at: string;
    last_login_at: string | null;
    email_verified_at: string | null;
    balance: string;
  }>(
    `select p.id, p.email, p.display_name, p.username, p.phone, p.role_id, p.status, p.created_at,
            p.last_login_at, p.email_verified_at, coalesce(w.balance, 0) as balance
     from profiles p left join wallets w on w.user_id = p.id where p.id = $1`,
    [id],
  );
  if (!customer) return null;
  const [orders, payments, ledger, tickets] = await Promise.all([
    many<{ id: string; order_number: string; total: string; status: string; created_at: string }>(
      "select id, order_number, total, status, created_at from orders where user_id = $1 order by created_at desc limit 20",
      [id],
    ),
    many<{ reference: string; amount: string; status: string; purpose: string; created_at: string }>(
      "select reference, amount, status, purpose, created_at from payments where user_id = $1 order by created_at desc limit 20",
      [id],
    ),
    many<{ id: string; type: string; amount: string; balance_after: string; description: string; created_at: string }>(
      "select id, type, amount, balance_after, description, created_at from wallet_transactions where user_id = $1 order by created_at desc limit 20",
      [id],
    ),
    many<{ id: string; ticket_number: string; subject: string; status: string; created_at: string }>(
      "select id, ticket_number, subject, status, created_at from support_tickets where user_id = $1 order by created_at desc limit 10",
      [id],
    ),
  ]);
  return { customer, orders, payments, ledger, tickets };
}

export async function listAdminProducts(q?: string) {
  const values: unknown[] = [];
  let where = "1=1";
  if (q?.trim()) {
    values.push(`%${q.trim()}%`);
    where = `(p.name_th ilike $1 or p.name_en ilike $1 or p.slug ilike $1)`;
  }
  return many<{
    id: string;
    slug: string;
    name_th: string;
    name_en: string;
    price: string;
    compare_at_price: string | null;
    stock_mode: string;
    stock_quantity: number;
    is_active: boolean;
    is_featured: boolean;
    product_type: string;
    category_name: string;
    category_id: string;
    sold_count: number;
    image_url: string | null;
    variant_count: number;
  }>(
    `select p.id, p.slug, p.name_th, p.name_en, p.price, p.compare_at_price, p.stock_mode,
            p.stock_quantity, p.is_active, p.is_featured, p.product_type, c.name_en as category_name,
            c.id as category_id, p.sold_count,
            (select url from product_images pi where pi.product_id = p.id order by sort_order limit 1) as image_url,
            (select count(*)::int from product_variants v where v.product_id = p.id) as variant_count
     from products p join categories c on c.id = p.category_id where ${where}
     order by p.created_at desc`,
    values,
  );
}

export async function getAdminProduct(id: string) {
  const product = await one<Record<string, unknown>>("select * from products where id = $1::uuid", [id]);
  if (!product) return null;
  const [images, variants, inventory] = await Promise.all([
    many<{ id: string; url: string; alt: string | null; sort_order: number }>(
      "select id, url, alt, sort_order from product_images where product_id = $1 order by sort_order",
      [id],
    ),
    many<Record<string, unknown>>("select * from product_variants where product_id = $1 order by sort_order", [id]),
    many<{ id: string; payload_hint: string | null; status: string; created_at: string; variant_id: string | null; sold_at: string | null }>(
      "select id, payload_hint, status, created_at, variant_id, sold_at from product_inventory where product_id = $1 order by created_at desc limit 100",
      [id],
    ),
  ]);
  return { product, images, variants, inventory };
}

export async function listInventory(q?: string) {
  const values: unknown[] = [];
  let where = "1=1";
  if (q?.trim()) {
    values.push(`%${q.trim()}%`);
    where = `(p.name_en ilike $1 or p.slug ilike $1 or coalesce(i.payload_hint,'') ilike $1)`;
  }
  return many<{
    id: string;
    product_id: string;
    product_name: string;
    product_slug: string;
    variant_name: string | null;
    status: string;
    payload_hint: string | null;
    created_at: string;
    sold_at: string | null;
    order_number: string | null;
  }>(
    `select i.id, i.product_id, p.name_en as product_name, p.slug as product_slug, v.name_en as variant_name, i.status,
            i.payload_hint, i.created_at, i.sold_at, o.order_number
     from product_inventory i join products p on p.id = i.product_id
     left join product_variants v on v.id = i.variant_id
     left join order_items oi on oi.id = i.order_item_id
     left join orders o on o.id = oi.order_id
     where ${where} order by i.created_at desc limit 200`,
    values,
  );
}

export async function listCoupons() {
  return many<{
    id: string;
    code: string;
    description: string | null;
    type: string;
    value: string;
    min_order: string;
    max_discount: string | null;
    starts_at: string | null;
    expires_at: string | null;
    usage_limit: number | null;
    used_count: number;
    per_user_limit: number;
    is_active: boolean;
    first_purchase_only: boolean;
    applies_to: Record<string, unknown>;
    created_at: string;
  }>("select * from coupons order by created_at desc");
}

export async function listPromotions() {
  return many<Record<string, unknown>>("select * from promotions order by sort_order, created_at desc");
}

export async function listBanners() {
  return many<Record<string, unknown>>("select * from banners order by placement, sort_order");
}

export async function listReviews(status?: string) {
  const values: unknown[] = [];
  let where = "1=1";
  if (status) {
    values.push(status);
    where = `r.status = $1`;
  }
  return many<{
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
    status: string;
    created_at: string;
    product_name: string;
    product_slug: string;
    display_name: string;
    email: string;
  }>(
    `select r.id, r.rating, r.title, r.body, r.status, r.created_at,
            p.name_en as product_name, p.slug as product_slug,
            u.display_name, u.email
     from reviews r join products p on p.id = r.product_id join profiles u on u.id = r.user_id
     where ${where} order by r.created_at desc limit 100`,
    values,
  );
}

export async function listTickets(status?: string) {
  const values: unknown[] = [];
  let where = "1=1";
  if (status) {
    values.push(status);
    where = `t.status = $1`;
  }
  return many<{
    id: string;
    ticket_number: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    created_at: string;
    last_message_at: string;
    email: string;
    display_name: string;
    message_count: number;
  }>(
    `select t.id, t.ticket_number, t.subject, t.category, t.priority, t.status, t.created_at, t.last_message_at,
            p.email, p.display_name,
            (select count(*)::int from support_messages m where m.ticket_id = t.id) as message_count
     from support_tickets t join profiles p on p.id = t.user_id
     where ${where} order by t.last_message_at desc limit 100`,
    values,
  );
}

export async function getTicketDetail(id: string) {
  const ticket = await one<{
    id: string;
    ticket_number: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    created_at: string;
    user_id: string;
    email: string;
    display_name: string;
  }>(
    `select t.id, t.ticket_number, t.subject, t.category, t.priority, t.status, t.created_at, t.user_id,
            p.email, p.display_name
     from support_tickets t join profiles p on p.id = t.user_id where t.id = $1::uuid`,
    [id],
  );
  if (!ticket) return null;
  const messages = await many<{
    id: string;
    body: string;
    is_internal: boolean;
    created_at: string;
    author_id: string | null;
    author_name: string | null;
    author_role: string | null;
  }>(
    `select m.id, m.body, m.is_internal, m.created_at, m.author_id,
            coalesce(p.display_name, 'System') as author_name,
            p.role_id as author_role
     from support_messages m left join profiles p on p.id = m.author_id
     where m.ticket_id = $1::uuid order by m.created_at asc`,
    [ticket.id],
  );
  return { ticket, messages };
}

export async function listAuditLogs(page = 1) {
  const pageSize = 50;
  const count = await one<{ count: number }>("select count(*)::int as count from audit_logs");
  const rows = await many<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    actor_email: string | null;
    ip: string | null;
    created_at: string;
    after: unknown;
  }>(
    `select id, action, entity_type, entity_id, actor_email, ip, created_at, after
     from audit_logs order by created_at desc limit $1 offset $2`,
    [pageSize, (page - 1) * pageSize],
  );
  return { rows, total: Number(count?.count ?? 0), page, pageSize };
}

export async function listStaff() {
  return many<{
    id: string;
    email: string;
    display_name: string;
    role_id: string;
    status: string;
    last_login_at: string | null;
    created_at: string;
  }>(
    `select id, email, display_name, role_id, status, last_login_at, created_at
     from profiles where role_id <> 'customer' order by role_id, created_at`,
  );
}

export async function rolePermissionMatrix() {
  const [roles, permissions, mapping] = await Promise.all([
    many<{ id: string; name: string; description: string | null }>("select id, name, description from roles order by id"),
    many<{ id: string; category: string; description: string }>("select id, category, description from permissions order by category, id"),
    many<{ role_id: string; permission_id: string }>("select role_id, permission_id from role_permissions"),
  ]);
  const byRole = new Map<string, Set<string>>();
  for (const row of mapping) {
    if (!byRole.has(row.role_id)) byRole.set(row.role_id, new Set());
    byRole.get(row.role_id)!.add(row.permission_id);
  }
  return { roles, permissions, byRole };
}

export async function adminTopupData() {
  const [games, products, orders] = await Promise.all([
    many<{
      id: string;
      slug: string;
      name: string;
      logo_url: string | null;
      fields: { key: string; label: string; required?: boolean; pattern?: string; placeholder?: string }[];
      is_active: boolean;
      product_count: number;
    }>(
      `select g.id, g.slug, g.name, g.logo_url, g.fields, g.is_active,
              (select count(*)::int from game_topup_products p where p.game_id = g.id) as product_count
       from game_topup_games g order by g.sort_order`,
    ),
    many<{
      id: string;
      game_id: string;
      game_name: string;
      name: string;
      sku: string | null;
      price: string;
      compare_at_price: string | null;
      delivery_type: string;
      is_active: boolean;
    }>(
      `select gp.id, gp.game_id, g.name as game_name, gp.name, gp.sku, gp.price, gp.compare_at_price,
              gp.delivery_type, gp.is_active
       from game_topup_products gp join game_topup_games g on g.id = gp.game_id order by g.name, gp.sort_order`,
    ),
    many<{
      id: string;
      order_number: string;
      game_name: string;
      package_name: string;
      player_fields: Record<string, string>;
      status: string;
      created_at: string;
      email: string;
      failure_reason: string | null;
      game_product_id: string | null;
      order_id: string;
    }>(
      `select gt.id, o.order_number, gt.game_name, gt.package_name, gt.player_fields, gt.status, gt.created_at,
              p.email, gt.failure_reason, gt.game_product_id, gt.order_id
       from game_topup_orders gt join orders o on o.id = gt.order_id join profiles p on p.id = gt.user_id
       order by gt.created_at desc limit 100`,
    ),
  ]);
  return { games, products, orders };
}

export async function analyticsData() {
  const [series, statusBreakdown, categoryRevenue, providers, deposits] = await Promise.all([
    many<{ day: string; revenue: string; orders: number }>(
      `select day::text, revenue, orders from v_daily_revenue where day >= current_date - interval '29 days' order by day`,
    ),
    many<{ status: string; count: number }>(
      "select status, count(*)::int as count from orders group by status order by count desc",
    ),
    many<{ category: string; revenue: string; units: number }>(
      `select c.name_en as category, coalesce(sum(oi.total),0) as revenue, coalesce(sum(oi.quantity),0)::int as units
       from order_items oi join orders o on o.id = oi.order_id
       left join products p on p.id = oi.product_id left join categories c on c.id = p.category_id
       where o.payment_status = 'paid' group by c.name_en order by revenue desc limit 8`,
    ),
    many<{ provider_id: string; total: string; count: number }>(
      `select provider_id, coalesce(sum(amount),0) as total, count(*)::int as count
       from payments where status = 'PAID' group by provider_id order by total desc`,
    ),
    many<{ day: string; total: string }>(
      `select paid_at::date::text as day, sum(amount) as total from payments
       where purpose = 'wallet_deposit' and status = 'PAID' and paid_at >= current_date - interval '29 days'
       group by 1 order by 1`,
    ),
  ]);
  return { series, statusBreakdown, categoryRevenue, providers, deposits };
}
