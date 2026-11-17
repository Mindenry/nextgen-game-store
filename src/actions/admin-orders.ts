"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit";
import { many, one, run, withTransaction } from "@/lib/db";
import { refundOrder, setManualDelivery } from "@/lib/orders";
import { notify } from "@/lib/notifications";
import { applyWalletEntry } from "@/lib/wallet";
import { toMinor, toNumericString } from "@/lib/money";
import { slugify } from "@/lib/utils";

export type AdminResult = { error?: string; success?: string };

function s(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

async function guard(permission: string) {
  const user = await requireStaff();
  if (!can(user, permission)) throw new Error("You do not have permission to do that.");
  return user;
}

export async function updateOrderStatusAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.ordersManage);
    const orderId = s(formData, "orderId");
    const status = s(formData, "status");
    const allowed = ["processing", "completed", "cancelled"];
    if (!orderId || !allowed.includes(status)) return { error: "Invalid status change." };

    const order = await one<{ status: string; payment_status: string; order_number: string; user_id: string }>(
      "select status, payment_status, order_number, user_id from orders where id = $1 for update",
      [orderId],
    );
    if (!order) return { error: "Order not found." };
    if (order.status === "refunded") return { error: "Refunded orders cannot change status." };
    if (status === "cancelled" && order.payment_status === "paid") {
      return { error: "Paid orders must be refunded instead of cancelled." };
    }
    if (status === "completed" && order.payment_status !== "paid") {
      return { error: "Only paid orders can be completed." };
    }
    await run(
      `update orders set status = $2,
         completed_at = case when $2 = 'completed' then now() else completed_at end, updated_at = now()
       where id = $1`,
      [orderId, status],
    );
    await notify({
      userId: order.user_id,
      type: status === "completed" ? "purchase_completed" : "account",
      title: status === "completed" ? "Order completed" : "Order updated",
      body: `Order ${order.order_number} is now ${status}.`,
      link: `/dashboard/orders/${order.order_number}`,
    });
    await audit({
      actorId: user.id,
      actorEmail: user.email,
      action: "order.status_change",
      entityType: "order",
      entityId: orderId,
      before: { status: order.status },
      after: { status },
    });
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    return { success: "Order updated." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update the order." };
  }
}

export async function saveOrderNoteAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.ordersManage);
    const orderId = s(formData, "orderId");
    const note = s(formData, "internalNote").slice(0, 2000);
    await run("update orders set internal_note = $2, updated_at = now() where id = $1", [orderId, note]);
    await audit({ actorId: user.id, actorEmail: user.email, action: "order.note", entityType: "order", entityId: orderId, after: { note } });
    revalidatePath(`/admin/orders/${orderId}`);
    return { success: "Internal note saved." };
  } catch (error) {
    return { error: "Could not save the note." };
  }
}

export async function refundOrderAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.ordersRefund);
    const orderId = s(formData, "orderId");
    const reason = s(formData, "reason");
    if (reason.length < 5) return { error: "Give a reason of at least 5 characters." };
    await refundOrder(orderId, user.id, reason);
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/payments");
    return { success: "Order refunded to the customer's wallet." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not refund the order." };
  }
}

export async function manualDeliveryAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    await guard(PERMISSIONS.ordersManage);
    const orderItemId = s(formData, "orderItemId");
    const note = s(formData, "deliveryNote");
    const complete = formData.get("complete") === "on";
    const payloadRaw = s(formData, "payload");
    let payload: Record<string, string> | undefined;
    if (payloadRaw) {
      try {
        const parsed = JSON.parse(payloadRaw) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { error: "Payload must be a JSON object." };
        payload = Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>)
            .filter(([, v]) => typeof v === "string")
            .map(([k, v]) => [k, String(v)]),
        );
      } catch {
        return { error: "Payload must be valid JSON." };
      }
    }
    await setManualDelivery({ orderItemId, adminId: (await guard(PERMISSIONS.ordersManage)).id, payload, note, complete });
    revalidatePath(`/admin/orders`);
    return { success: complete ? "Item delivered to the customer." : "Delivery saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the delivery." };
  }
}

// ---------------------------------------------------------------------------
// Game top-up management
// ---------------------------------------------------------------------------
export async function saveTopupGameAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.topupManage);
    const id = s(formData, "id");
    const name = s(formData, "name");
    if (!name) return { error: "Game name is required." };
    const slug = slugify(s(formData, "slug") || name);
    let fields: unknown = [];
    try {
      fields = JSON.parse(s(formData, "fields") || "[]");
    } catch {
      return { error: "Fields must be valid JSON." };
    }
    if (!Array.isArray(fields)) return { error: "Fields must be an array." };
    for (const field of fields) {
      if (!field || typeof field !== "object") return { error: "Each field must be an object." };
      const f = field as Record<string, unknown>;
      if (typeof f.key !== "string" || typeof f.label !== "string") {
        return { error: "Every field needs a string key and label." };
      }
    }
    const values = [name, slug, s(formData, "logoUrl") || null, s(formData, "bannerUrl") || null, JSON.stringify(fields), Number(s(formData, "sortOrder") || 0), formData.get("isActive") === "on"];
    if (id) {
      await run(
        `update game_topup_games set name=$1, slug=$2, logo_url=$3, banner_url=$4, fields=$5::jsonb,
           sort_order=$6, is_active=$7, updated_at=now() where id=$8`,
        [...values, id],
      );
    } else {
      await run(
        `insert into game_topup_games(name,slug,logo_url,banner_url,fields,sort_order,is_active)
         values ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
        values,
      );
    }
    await audit({ actorId: user.id, actorEmail: user.email, action: id ? "topup_game.update" : "topup_game.create", entityType: "game_topup_game", entityId: id || slug });
    revalidatePath("/admin/topup");
    revalidatePath("/topup");
    return { success: "Game saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the game." };
  }
}

export async function saveTopupPackageAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.topupManage);
    const id = s(formData, "id");
    const gameId = s(formData, "gameId");
    const name = s(formData, "name");
    const priceRaw = s(formData, "price");
    if (!gameId || !name || !/^\d{1,9}(\.\d{1,2})?$/.test(priceRaw)) {
      return { error: "Game, package name and a valid price are required." };
    }
    const slug = slugify(`${s(formData, "slug") || name}-${gameId.slice(0, 4)}`);
    const values = [gameId, name, slug, s(formData, "sku") || null, toNumericString(toMinor(priceRaw)), formData.get("compareAtPrice") ? toNumericString(toMinor(s(formData, "compareAtPrice"))) : null, "manual", formData.get("isActive") === "on", Number(s(formData, "sortOrder") || 0)];
    if (id) {
      await run(
        `update game_topup_products set game_id=$1, name=$2, slug=$3, sku=$4, price=$5, compare_at_price=$6,
           delivery_type=$7, is_active=$8, sort_order=$9, updated_at=now() where id=$10`,
        [...values, id],
      );
    } else {
      await run(
        `insert into game_topup_products(game_id,name,slug,sku,price,compare_at_price,delivery_type,is_active,sort_order)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        values,
      );
    }
    await audit({ actorId: user.id, actorEmail: user.email, action: id ? "topup_package.update" : "topup_package.create", entityType: "game_topup_product", entityId: id || slug });
    revalidatePath("/admin/topup");
    revalidatePath("/topup");
    return { success: "Package saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the package." };
  }
}

export async function processTopupAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.topupProcess);
    const topupId = s(formData, "topupId");
    const status = s(formData, "status");
    const note = s(formData, "note").slice(0, 500);
    if (!["PROCESSING", "COMPLETED", "FAILED", "MANUAL_REVIEW"].includes(status)) {
      return { error: "Invalid status." };
    }
    await withTransaction(async (tx) => {
      const topup = await one<{
        id: string;
        order_id: string;
        order_item_id: string;
        user_id: string;
        game_name: string;
        package_name: string;
        status: string;
      }>("select * from game_topup_orders where id = $1 for update", [topupId], tx);
      if (!topup) throw new Error("Top-up order not found.");
      if (topup.status === "REFUNDED") throw new Error("Refunded top-ups cannot be updated.");

      await tx.query(
        `update game_topup_orders set status = $2, failure_reason = $3, processed_by = $4,
           processed_at = case when $2 = 'COMPLETED' then now() else processed_at end, updated_at = now()
         where id = $1`,
        [topupId, status, status === "FAILED" ? note || "Fulfilment failed" : null, user.id],
      );
      if (status === "COMPLETED") {
        await tx.query(
          `update order_items set fulfillment_status = 'delivered', delivered_at = now(),
             delivery_note = coalesce($2, delivery_note), delivered_by = $3 where id = $1`,
          [topup.order_item_id, note || "Top-up completed", user.id],
        );
        const remaining = await one<{ count: number }>(
          "select count(*)::int as count from order_items where order_id = $1 and fulfillment_status not in ('delivered','refunded')",
          [topup.order_id],
          tx,
        );
        if (Number(remaining?.count ?? 0) === 0) {
          await tx.query(
            "update orders set status = 'completed', delivery_status = 'delivered', completed_at = now(), updated_at = now() where id = $1",
            [topup.order_id],
          );
        }
        await notify(
          {
            userId: topup.user_id,
            type: "topup_completed",
            title: "Top-up completed",
            body: `${topup.game_name} — ${topup.package_name} has been delivered.`,
            link: "/dashboard/products",
          },
          tx,
        );
      } else if (status === "FAILED") {
        await notify(
          {
            userId: topup.user_id,
            type: "topup_failed",
            title: "Top-up failed",
            body: `${topup.game_name} — ${topup.package_name}: ${note || "Please contact support."}`,
            link: "/dashboard/support",
          },
          tx,
        );
      }
      await audit(
        {
          actorId: user.id,
          actorEmail: user.email,
          action: "topup.process",
          entityType: "game_topup_order",
          entityId: topupId,
          before: { status: topup.status },
          after: { status, note },
        },
        tx,
      );
    });
    revalidatePath("/admin/topup");
    return { success: "Top-up order updated." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update the top-up order." };
  }
}

export async function refundTopupAction(topupId: string): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.ordersRefund);
    await withTransaction(async (tx) => {
      const topup = await one<{
        id: string;
        order_id: string;
        order_item_id: string;
        user_id: string;
        status: string;
        game_name: string;
        package_name: string;
      }>("select * from game_topup_orders where id = $1 for update", [topupId], tx);
      if (!topup) throw new Error("Top-up not found.");
      if (topup.status === "REFUNDED") throw new Error("Already refunded.");
      const item = await one<{ total: string; order_number: string }>(
        `select oi.total, o.order_number from order_items oi join orders o on o.id = oi.order_id where oi.id = $1`,
        [topup.order_item_id],
        tx,
      );
      if (!item) throw new Error("Order item not found.");
      await applyWalletEntry(tx, {
        userId: topup.user_id,
        amountMinor: toMinor(item.total),
        type: "refund",
        description: `Refund for failed top-up ${item.order_number}`,
        orderId: topup.order_id,
        adminId: user.id,
      });
      await tx.query(
        "update game_topup_orders set status = 'REFUNDED', failure_reason = 'Refunded by staff', updated_at = now() where id = $1",
        [topup.id]
      );
      await tx.query("update order_items set fulfillment_status = 'refunded' where id = $1", [topup.order_item_id],);
      const remaining = await one<{ count: number }>(
        "select count(*)::int as count from order_items where order_id = $1 and fulfillment_status not in ('delivered','refunded')",
        [topup.order_id],
        tx,
      );
      if (Number(remaining?.count ?? 0) === 0) {
        await tx.query(
          "update orders set status = 'refunded', payment_status = 'refunded', updated_at = now() where id = $1",
          [topup.order_id]
        );
      }
      await notify(
        {
          userId: topup.user_id,
          type: "refund_completed",
          title: "Top-up refunded",
          body: `${topup.game_name} — ${topup.package_name} was refunded to your wallet.`,
          link: "/dashboard/wallet",
        },
        tx,
      );
      await audit(
        {
          actorId: user.id,
          actorEmail: user.email,
          action: "topup.refund",
          entityType: "game_topup_order",
          entityId: topup.id,
          after: { amount: item.total },
        },
        tx,
      );
    });
    revalidatePath("/admin/topup");
    return { success: "Top-up refunded to wallet." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not refund the top-up." };
  }
}

