import Link from "next/link";
import { KeyRound, ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listUserProducts } from "@/lib/orders";
import { Alert, buttonClass } from "@/components/ui";
import { MyProductsList } from "@/components/my-products-list";

export const metadata = { title: "My products" };

export default async function MyProductsPage() {
  const user = await requireUser("/dashboard/products");
  const products = await listUserProducts(user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Vault</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold md:text-3xl">
            <KeyRound className="size-6 text-primary" /> My products
          </h1>
          <p className="mt-1 text-sm text-muted">Credentials and delivered top-ups from your paid orders.</p>
        </div>
        <Link href="/dashboard/orders" className={buttonClass({ variant: "outline", size: "sm" })}>
          View orders
        </Link>
      </div>

      <Alert variant="info">
        <span className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            These credentials are encrypted at rest and visible only to you and authorised staff. Never share them —
            anyone with access can use the product.
          </span>
        </span>
      </Alert>

      <MyProductsList products={products} />
    </div>
  );
}
