"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { many, one, run } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { rateLimit } from "@/lib/rate-limit";
import { firstError, reviewSchema, ticketSchema } from "@/lib/validation";
import { LANG_COOKIE } from "@/lib/i18n";

export type FormState = { error?: string; success?: string };

export async function setLanguageAction(formData: FormData): Promise<void> {
  const lang = formData.get("lang") === "en" ? "en" : "th";
  const store = await cookies();
  store.set(LANG_COOKIE, lang, {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    path: "/",
    httpOnly: false,
  });
  revalidatePath("/", "layout");
}

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get("id") ?? "");
  await run("update notifications set read_at = now() where id = $1::uuid and user_id = $2", [id, user.id]);
  revalidatePath("/dashboard/notifications");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await run("update notifications set read_at = now() where user_id = $1 and read_at is null", [user.id]);
  revalidatePath("/dashboard/notifications");
}

export async function createTicketAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to open a support ticket." };
  const limit = await rateLimit(`ticket:${user.id}`, 5, 3600);
  if (!limit.allowed) return { error: "You have opened several tickets recently. Please wait before opening another." };

  const parsed = ticketSchema.safeParse({
    subject: formData.get("subject"),
    category: formData.get("category") ?? "general",
    priority: formData.get("priority") ?? "normal",
    message: formData.get("message"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const numberRow = await one<{ n: string }>("select next_ticket_number() as n");
  const ticket = await one<{ id: string; ticket_number: string }>(
    `insert into support_tickets(ticket_number, user_id, subject, category, priority)
     values ($1,$2,$3,$4,$5) returning id, ticket_number`,
    [numberRow!.n, user.id, parsed.data.subject, parsed.data.category, parsed.data.priority],
  );
  await run(
    `insert into support_messages(ticket_id, author_id, body) values ($1,$2,$3)`,
    [ticket!.id, user.id, parsed.data.message],
  );

  const staff = await many<{ id: string }>(
    `select p.id from profiles p join role_permissions rp on rp.role_id = p.role_id
     where rp.permission_id = 'support.reply' and p.status = 'active'`,
  );
  for (const member of staff) {
    await notify({
      userId: member.id,
      type: "support_reply",
      title: "New support ticket",
      body: `${ticket!.ticket_number}: ${parsed.data.subject}`,
      link: `/admin/support/${ticket!.id}`,
    });
  }
  redirect(`/dashboard/support/${ticket!.id}`);
}

export async function replyTicketAction(formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  const ticketId = String(formData.get("ticketId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 2 || body.length > 4000) return { error: "Write a message between 2 and 4000 characters." };

  const ticket = await one<{ id: string; status: string; ticket_number: string }>(
    "select id, status, ticket_number from support_tickets where id = $1::uuid and user_id = $2",
    [ticketId, user.id],
  );
  if (!ticket) return { error: "Ticket not found." };
  if (ticket.status === "closed") return { error: "This ticket is closed. Open a new ticket instead." };

  await run("insert into support_messages(ticket_id, author_id, body) values ($1,$2,$3)", [ticket.id, user.id, body]);
  await run(
    "update support_tickets set status = 'open', last_message_at = now(), updated_at = now() where id = $1",
    [ticket.id],
  );
  const staff = await many<{ id: string }>(
    `select p.id from profiles p join role_permissions rp on rp.role_id = p.role_id
     where rp.permission_id = 'support.reply' and p.status = 'active'`,
  );
  for (const member of staff) {
    await notify({
      userId: member.id,
      type: "support_reply",
      title: "New reply on a support ticket",
      body: ticket.ticket_number,
      link: `/admin/support/${ticket.id}`,
    });
  }
  revalidatePath(`/dashboard/support/${ticket.id}`);
  return { success: "Message sent." };
}

export async function replyTicketFormAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return replyTicketAction(formData);
}

export async function closeTicketAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const ticketId = String(formData.get("ticketId") ?? "");
  await run(
    "update support_tickets set status = 'closed', updated_at = now() where id = $1::uuid and user_id = $2",
    [ticketId, user.id],
  );
  revalidatePath(`/dashboard/support/${ticketId}`);
}

export async function toggleFavoriteAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/products");
  const productId = String(formData.get("productId") ?? "");
  const existing = await one<{ product_id: string }>(
    "select product_id from favorites where user_id = $1 and product_id = $2::uuid",
    [user.id, productId],
  );
  if (existing) {
    await run("delete from favorites where user_id = $1 and product_id = $2::uuid", [user.id, productId]);
  } else {
    await run("insert into favorites(user_id, product_id) values ($1,$2::uuid) on conflict do nothing", [
      user.id,
      productId,
    ]);
  }
  revalidatePath("/products");
  revalidatePath("/dashboard/favorites");
}

export async function submitReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to review a purchase." };
  const parsed = reviewSchema.safeParse({
    orderItemId: formData.get("orderItemId"),
    rating: formData.get("rating"),
    title: formData.get("title") || undefined,
    body: formData.get("body") || undefined,
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const item = await one<{ product_id: string | null; order_id: string; user_id: string; payment_status: string }>(
    `select oi.product_id, oi.order_id, o.user_id, o.payment_status
     from order_items oi join orders o on o.id = oi.order_id
     where oi.id = $1::uuid and o.user_id = $2`,
    [parsed.data.orderItemId, user.id],
  );
  if (!item || item.payment_status !== "paid" || !item.product_id) {
    return { error: "You can only review products from a paid order." };
  }
  const existing = await one<{ id: string }>("select id from reviews where order_item_id = $1::uuid", [parsed.data.orderItemId]);
  if (existing) return { error: "You have already reviewed this item." };

  await run(
    `insert into reviews(product_id, user_id, order_item_id, rating, title, body, status)
     values ($1,$2,$3,$4,$5,$6,'pending')`,
    [item.product_id, user.id, parsed.data.orderItemId, parsed.data.rating, parsed.data.title ?? null, parsed.data.body ?? null],
  );
  revalidatePath("/dashboard/orders");
  return { success: "Thanks! Your review will appear after moderation." };
}
