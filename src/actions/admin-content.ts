"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit";
import { many, one, run } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import { notify } from "@/lib/notifications";
import { setSettings } from "@/lib/settings";
import { toMinor, toNumericString } from "@/lib/money";
import { runtimeMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

export type AdminResult = { error?: string; success?: string };

function s(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
function dateOrNull(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
async function guard(permission: string) {
  const user = await requireStaff();
  if (!can(user, permission)) throw new Error("You do not have permission to do that.");
  return user;
}

export async function saveCouponAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.couponsManage);
    const id = s(formData, "id");
    const code = s(formData, "code").toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    const type = s(formData, "type");
    const valueRaw = s(formData, "value");
    if (code.length < 3) return { error: "Coupon code must be at least 3 characters." };
    if (!["percentage", "fixed"].includes(type)) return { error: "Choose percentage or fixed discount." };
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(valueRaw)) return { error: "Enter a valid coupon value." };
    if (type === "percentage" && (Number(valueRaw) <= 0 || Number(valueRaw) > 100)) {
      return { error: "Percentage must be between 0 and 100." };
    }
    const minOrder = s(formData, "minOrder") ? toNumericString(toMinor(s(formData, "minOrder"))) : "0";
    const maxDiscount = s(formData, "maxDiscount") ? toNumericString(toMinor(s(formData, "maxDiscount"))) : null;
    const productSlugs = s(formData, "productSlugs").split(",").map((x) => x.trim()).filter(Boolean);
    const categorySlugs = s(formData, "categorySlugs").split(",").map((x) => x.trim()).filter(Boolean);
    const productIds = productSlugs.length
      ? (await many<{ id: string }>("select id from products where slug = any($1::text[])", [productSlugs])).map((r) => r.id)
      : [];
    const categoryIds = categorySlugs.length
      ? (await many<{ id: string }>("select id from categories where slug = any($1::text[])", [categorySlugs])).map((r) => r.id)
      : [];
    const appliesTo = JSON.stringify({ product_ids: productIds, category_ids: categoryIds });
    const values = [
      code,
      s(formData, "description") || null,
      type,
      toNumericString(toMinor(valueRaw)),
      minOrder,
      maxDiscount,
      dateOrNull(s(formData, "startsAt")),
      dateOrNull(s(formData, "expiresAt")),
      s(formData, "usageLimit") ? Number(s(formData, "usageLimit")) : null,
      Number(s(formData, "perUserLimit") || 1),
      appliesTo,
      formData.get("firstPurchaseOnly") === "on",
      formData.get("isActive") === "on",
    ];
    if (id) {
      await run(
        `update coupons set code=$1, description=$2, type=$3, value=$4, min_order=$5, max_discount=$6,
           starts_at=$7, expires_at=$8, usage_limit=$9, per_user_limit=$10, applies_to=$11::jsonb,
           first_purchase_only=$12, is_active=$13, updated_at=now() where id=$14`,
        [...values, id],
      );
    } else {
      await run(
        `insert into coupons(code,description,type,value,min_order,max_discount,starts_at,expires_at,usage_limit,
           per_user_limit,applies_to,first_purchase_only,is_active)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13)`,
        values,
      );
    }
    await audit({ actorId: user.id, actorEmail: user.email, action: id ? "coupon.update" : "coupon.create", entityType: "coupon", entityId: id || code, after: { code, type, value: valueRaw } });
    revalidatePath("/admin/coupons");
    return { success: "Coupon saved." };
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) return { error: "That coupon code already exists." };
    return { error: error instanceof Error ? error.message : "Could not save the coupon." };
  }
}

export async function toggleCouponAction(id: string): Promise<AdminResult> {
  try {
    await guard(PERMISSIONS.couponsManage);
    await run("update coupons set is_active = not is_active, updated_at = now() where id = $1", [id]);
    revalidatePath("/admin/coupons");
    return { success: "Coupon updated." };
  } catch {
    return { error: "Could not update the coupon." };
  }
}

export async function savePromotionAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    await guard(PERMISSIONS.promotionsManage);
    const id = s(formData, "id");
    const title = s(formData, "title");
    if (!title) return { error: "Title is required." };
    const values = [
      title,
      s(formData, "subtitle") || null,
      s(formData, "imageUrl") || null,
      s(formData, "ctaLabel") || null,
      s(formData, "ctaUrl") || null,
      s(formData, "badge") || null,
      formData.get("isActive") === "on",
      dateOrNull(s(formData, "startsAt")),
      dateOrNull(s(formData, "endsAt")),
      Number(s(formData, "sortOrder") || 0),
    ];
    if (id) {
      await run(
        `update promotions set title=$1, subtitle=$2, image_url=$3, cta_label=$4, cta_url=$5, badge=$6,
           is_active=$7, starts_at=$8, ends_at=$9, sort_order=$10, updated_at=now() where id=$11`,
        [...values, id],
      );
    } else {
      await run(
        `insert into promotions(title,subtitle,image_url,cta_label,cta_url,badge,is_active,starts_at,ends_at,sort_order)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        values,
      );
    }
    revalidatePath("/admin/promotions");
    revalidatePath("/");
    return { success: "Promotion saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the promotion." };
  }
}

export async function saveBannerAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    await guard(PERMISSIONS.bannersManage);
    const id = s(formData, "id");
    const title = s(formData, "title");
    if (!title) return { error: "Title is required." };
    const values = [
      s(formData, "placement") || "hero",
      title,
      s(formData, "subtitle") || null,
      s(formData, "imageUrl") || null,
      s(formData, "ctaLabel") || null,
      s(formData, "ctaUrl") || null,
      formData.get("isActive") === "on",
      Number(s(formData, "sortOrder") || 0),
      dateOrNull(s(formData, "startsAt")),
      dateOrNull(s(formData, "endsAt")),
    ];
    if (id) {
      await run(
        `update banners set placement=$1, title=$2, subtitle=$3, image_url=$4, cta_label=$5, cta_url=$6,
           is_active=$7, sort_order=$8, starts_at=$9, ends_at=$10, updated_at=now() where id=$11`,
        [...values, id],
      );
    } else {
      await run(
        `insert into banners(placement,title,subtitle,image_url,cta_label,cta_url,is_active,sort_order,starts_at,ends_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        values,
      );
    }
    revalidatePath("/admin/banners");
    revalidatePath("/");
    return { success: "Banner saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the banner." };
  }
}

export async function deleteContentAction(kind: string, id: string): Promise<AdminResult> {
  try {
    const permission =
      kind === "promotion" ? PERMISSIONS.promotionsManage : kind === "banner" ? PERMISSIONS.bannersManage : null;
    if (!permission) return { error: "Invalid content type." };
    await guard(permission);
    const table = kind === "promotion" ? "promotions" : "banners";
    await run(`delete from ${table} where id = $1`, [id]);
    revalidatePath(`/admin/${kind}s`);
    revalidatePath("/");
    return { success: "Deleted." };
  } catch {
    return { error: "Could not delete." };
  }
}

export async function moderateReviewAction(formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.reviewsManage);
    const reviewId = s(formData, "reviewId");
    const decision = s(formData, "decision");
    if (!["approved", "rejected", "pending"].includes(decision)) return { error: "Invalid decision." };
    const review = await one<{ product_id: string; user_id: string }>(
      "update reviews set status = $2, admin_note = $3, updated_at = now() where id = $1 returning product_id, user_id",
      [reviewId, decision, s(formData, "note") || null],
    );
    if (!review) return { error: "Review not found." };
    await run("select recalc_product_rating($1)", [review.product_id]);
    if (decision === "approved") {
      await notify({
        userId: review.user_id,
        type: "account",
        title: "Your review is live",
        body: "Thanks for sharing your experience.",
        link: "/dashboard/orders",
      });
    }
    await audit({ actorId: user.id, actorEmail: user.email, action: `review.${decision}`, entityType: "review", entityId: reviewId });
    revalidatePath("/admin/reviews");
    return { success: `Review ${decision}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not moderate the review." };
  }
}

export async function moderateReviewFormAction(formData: FormData): Promise<void> {
  await moderateReviewAction(formData);
}

export async function setTicketStatusFormAction(formData: FormData): Promise<void> {
  await setTicketStatusAction(formData);
}

export async function changeStaffRoleFormAction(formData: FormData): Promise<void> {
  await changeStaffRoleAction(formData);
}

export async function replyTicketAdminAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.supportReply);
    const ticketId = s(formData, "ticketId");
    const body = s(formData, "body");
    const internal = formData.get("internal") === "on";
    if (body.length < 2) return { error: "Write a reply." };
    const ticket = await one<{ id: string; user_id: string; ticket_number: string; status: string }>(
      "select id, user_id, ticket_number, status from support_tickets where id = $1::uuid",
      [ticketId],
    );
    if (!ticket) return { error: "Ticket not found." };
    await run(
      "insert into support_messages(ticket_id, author_id, body, is_internal) values ($1,$2,$3,$4)",
      [ticket.id, user.id, body, internal],
    );
    if (!internal) {
      await run(
        "update support_tickets set status = 'pending', last_message_at = now(), assigned_to = coalesce(assigned_to, $2), updated_at = now() where id = $1",
        [ticket.id, user.id],
      );
      await notify({
        userId: ticket.user_id,
        type: "support_reply",
        title: `Reply on ${ticket.ticket_number}`,
        body: body.slice(0, 160),
        link: `/dashboard/support/${ticket.id}`,
      });
    }
    await audit({ actorId: user.id, actorEmail: user.email, action: "support.reply", entityType: "support_ticket", entityId: ticket.id });
    revalidatePath(`/admin/support/${ticket.id}`);
    return { success: "Reply sent." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not send the reply." };
  }
}

export async function setTicketStatusAction(formData: FormData): Promise<AdminResult> {
  try {
    await guard(PERMISSIONS.supportReply);
    const ticketId = s(formData, "ticketId");
    const status = s(formData, "status");
    if (!["open", "pending", "resolved", "closed"].includes(status)) return { error: "Invalid status." };
    await run("update support_tickets set status = $2, updated_at = now() where id = $1", [ticketId, status]);
    revalidatePath(`/admin/support/${ticketId}`);
    return { success: "Ticket updated." };
  } catch {
    return { error: "Could not update the ticket." };
  }
}

export async function setCustomerStatusAction(formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.customersManage);
    const userId = s(formData, "userId");
    const status = s(formData, "status");
    if (!["active", "suspended"].includes(status)) return { error: "Invalid status." };
    const target = await one<{ role_id: string }>("select role_id from profiles where id = $1", [userId]);
    if (!target) return { error: "Customer not found." };
    if (target.role_id !== "customer") return { error: "Staff accounts must be managed from Staff Management." };
    await run("update profiles set status = $2, updated_at = now() where id = $1", [userId, status]);
    if (status === "suspended") {
      await run("delete from sessions where user_id = $1", [userId]);
    }
    await audit({ actorId: user.id, actorEmail: user.email, action: `customer.${status}`, entityType: "profile", entityId: userId });
    revalidatePath("/admin/customers");
    return { success: `Account ${status === "suspended" ? "suspended" : "reactivated"}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update the customer." };
  }
}

export async function setCustomerStatusBoundAction(userId: string, status: "active" | "suspended"): Promise<AdminResult> {
  const formData = new FormData();
  formData.set("userId", userId);
  formData.set("status", status);
  return setCustomerStatusAction(formData);
}

export async function changeStaffRoleAction(formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.staffManage);
    const userId = s(formData, "userId");
    const roleId = s(formData, "roleId");
    if (userId === user.id && roleId !== "super_admin") {
      return { error: "You cannot remove your own super admin role." };
    }
    const role = await one<{ id: string }>("select id from roles where id = $1", [roleId]);
    if (!role) return { error: "Role not found." };
    await run("update profiles set role_id = $2, updated_at = now() where id = $1", [userId, roleId]);
    await run("delete from sessions where user_id = $1", [userId]);
    await audit({ actorId: user.id, actorEmail: user.email, action: "staff.role_change", entityType: "profile", entityId: userId, after: { roleId } });
    revalidatePath("/admin/staff");
    return { success: "Role updated. The staff member must sign in again." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update the role." };
  }
}

export async function createStaffAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.staffManage);
    const email = s(formData, "email").toLowerCase();
    const name = s(formData, "displayName");
    const roleId = s(formData, "roleId");
    const password = s(formData, "password");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email." };
    if (name.length < 2) return { error: "Enter the staff member's name." };
    if (!["support", "finance", "product_manager", "admin", "super_admin"].includes(roleId)) {
      return { error: "Invalid staff role." };
    }
    if (await one("select id from profiles where email_lower = $1", [email])) {
      return { error: "An account with that email already exists." };
    }

    if (runtimeMode === "supabase") {
      const supabase = await createSupabaseServerClient();
      const anon = supabase;
      if (!anon) return { error: "Supabase is not configured." };
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false },
      });
      const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: password || undefined,
        user_metadata: { full_name: name },
      });
      if (error || !data.user) return { error: error?.message ?? "Could not create the Supabase user." };
      await run(
        `insert into profiles(id, email, display_name, role_id, email_verified_at)
         values ($1,$2,$3,$4, now())
         on conflict (id) do update set role_id = $4, display_name = $3`,
        [data.user.id, email, name, roleId],
      );
      await run("insert into wallets(user_id) values ($1) on conflict do nothing", [data.user.id]);
    } else {
      if (password.length < 8) return { error: "Set a password of at least 8 characters." };
      const created = await one<{ id: string }>(
        "insert into profiles(email, password_hash, display_name, role_id, email_verified_at) values ($1,$2,$3,$4, now()) returning id",
        [email, await hashPassword(password), name, roleId],
      );
      await run("insert into wallets(user_id) values ($1) on conflict do nothing", [created!.id]);
    }
    await audit({ actorId: user.id, actorEmail: user.email, action: "staff.create", entityType: "profile", entityId: email, after: { roleId } });
    revalidatePath("/admin/staff");
    return { success: "Staff account created." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create the staff account." };
  }
}

export async function saveRolePermissionsAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.rolesManage);
    const roleId = s(formData, "roleId");
    if (roleId === "super_admin") return { error: "Super Admin always has every permission." };
    if (roleId === "customer") return { error: "Customer permissions are fixed." };
    const selected = formData.getAll("permissions").map(String);
    const valid = await many<{ id: string }>("select id from permissions where id = any($1::text[])", [selected]);
    await run("delete from role_permissions where role_id = $1", [roleId]);
    for (const permission of valid) {
      await run("insert into role_permissions(role_id, permission_id) values ($1,$2) on conflict do nothing", [roleId, permission.id]);
    }
    await audit({
      actorId: user.id,
      actorEmail: user.email,
      action: "roles.permissions_update",
      entityType: "role",
      entityId: roleId,
      after: { permissions: valid.map((p) => p.id) },
    });
    revalidatePath("/admin/roles");
    return { success: "Role permissions saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save permissions." };
  }
}

export async function saveStoreSettingsAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.settingsManage);
    const name = s(formData, "siteName");
    if (!name) return { error: "Store name is required." };
    const values: Record<string, unknown> = {
      "site.name": name,
      "site.tagline": s(formData, "tagline"),
      "site.description": s(formData, "description"),
      "site.logo_url": s(formData, "logoUrl"),
      "contact.email": s(formData, "contactEmail"),
      "contact.phone": s(formData, "contactPhone"),
      "contact.address": s(formData, "contactAddress"),
      "contact.hours": s(formData, "contactHours"),
      "social.discord": s(formData, "discord"),
      "social.facebook": s(formData, "facebook"),
      "social.instagram": s(formData, "instagram"),
      "social.line": s(formData, "line"),
      "store.maintenance_mode": formData.get("maintenanceMode") === "on",
      "store.registration_open": formData.get("registrationOpen") === "on",
      "store.language": s(formData, "defaultLanguage") === "en" ? "en" : "th",
      "footer.about": s(formData, "footerAbout"),
      "legal.terms": s(formData, "terms"),
      "legal.privacy": s(formData, "privacy"),
      "legal.refund": s(formData, "refund"),
    };
    await setSettings(values, user.id);
    await audit({ actorId: user.id, actorEmail: user.email, action: "settings.store_update", entityType: "system_settings", entityId: "store", after: { name } });
    revalidatePath("/", "layout");
    return { success: "Store settings saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save settings." };
  }
}

export async function broadcastNotificationAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.notificationsManage);
    const title = s(formData, "title");
    const body = s(formData, "body");
    if (title.length < 3) return { error: "Title is required." };
    const customers = await many<{ id: string }>("select id from profiles where status = 'active' and role_id = 'customer'");
    for (const customer of customers) {
      await notify({ userId: customer.id, type: "promotion", title, body, link: s(formData, "link") || "/products" });
    }
    await audit({ actorId: user.id, actorEmail: user.email, action: "notification.broadcast", entityType: "notification", after: { title, recipients: customers.length } });
    return { success: `Notification sent to ${customers.length} customer(s).` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not send notifications." };
  }
}
