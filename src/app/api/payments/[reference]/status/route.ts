import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPaymentByReference, syncPaymentStatus } from "@/lib/payments";
import { can, PERMISSIONS } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { reference } = await context.params;
  if (!/^[A-Za-z0-9]{6,40}$/.test(reference)) {
    return NextResponse.json({ error: "Invalid reference" }, { status: 400 });
  }

  const payment = await getPaymentByReference(reference);
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (payment.user_id !== user.id && !can(user, PERMISSIONS.paymentsView)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = await syncPaymentStatus(reference);
  return NextResponse.json(
    {
      reference,
      status,
      paidAt: payment.paid_at,
      expiresAt: payment.expires_at,
      purpose: payment.purpose,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
