import Link from "next/link";
import { AlertCircle, ArrowRight, LockKeyhole, ShoppingBag, Wallet } from "lucide-react";
import { getDetailedCart } from "@/lib/cart";
import { getCurrentUser } from "@/lib/auth";
import { getLocale, translate } from "@/lib/i18n";
import { formatMinorTHB } from "@/lib/money";
import { Alert, buttonClass, Card, EmptyState, Separator } from "@/components/ui";
import { ProductImage } from "@/components/product-card";
import { CartLineControls } from "@/components/cart-line-controls";

export const metadata = { title: "Cart" };

export default async function CartPage() {
  const [cart, user, locale] = await Promise.all([getDetailedCart(), getCurrentUser(), getLocale()]);
  const tr = (key: string) => translate(locale, key);

  return (
    <div className="container-page py-8 md:py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Checkout step 1</p>
          <h1 className="mt-1 text-3xl font-semibold">{tr("cart.title")}</h1>
        </div>
        <Link href="/products" className={buttonClass({ variant: "ghost", size: "sm" })}>
          {tr("cart.continueShopping")}
        </Link>
      </div>

      {cart.items.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<ShoppingBag className="size-5" />}
          title={tr("cart.empty")}
          description={tr("cart.emptyBody")}
          action={<Link href="/products" className={buttonClass({ size: "sm" })}>{tr("home.browseProducts")}</Link>}
        />
      ) : (
        <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <div className="space-y-3">
            {cart.hasIssues ? (
              <Alert variant="warning" title="Some items need attention">
                Remove or update the highlighted items before checkout.
              </Alert>
            ) : null}

            {cart.items.map((item, index) => (
              <div key={`${item.productId}:${item.variantId ?? "base"}`} className="surface-card flex gap-3.5 p-3.5 sm:p-4">
                <Link href={item.slug ? `/products/${item.slug}` : "/products"} className="shrink-0">
                  <ProductImage
                    imageUrl={item.imageUrl}
                    name={item.name}
                    icon="Gamepad2"
                    index={index}
                    className="size-20 rounded-xl sm:size-24"
                  />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={item.slug ? `/products/${item.slug}` : "/products"} className="line-clamp-2 text-sm font-semibold text-fg hover:text-primary">
                        {item.name}
                      </Link>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {item.deliveryMethod === "auto" ? "Instant delivery" : "Manual delivery"} · {formatMinorTHB(item.unitPriceMinor)} each
                      </p>
                    </div>
                    <p className="tabular text-sm font-semibold text-fg">{formatMinorTHB(item.lineTotalMinor)}</p>
                  </div>
                  {item.issue ? (
                    <p className="mt-2 flex items-start gap-1.5 text-[11px] font-medium text-danger">
                      <AlertCircle className="mt-px size-3.5 shrink-0" /> {item.issue}
                    </p>
                  ) : null}
                  <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                    <p className="text-[11px] text-muted">
                      {item.available === 999 ? "In stock" : `${item.available} available`}
                    </p>
                    <CartLineControls
                      productId={item.productId}
                      variantId={item.variantId}
                      quantity={item.quantity}
                      max={item.available === 999 ? 10 : item.available}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <aside className="surface-card sticky top-24 p-5">
            <h2 className="text-sm font-semibold">{tr("checkout.summary")}</h2>
            <div className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between text-muted">
                <span>{tr("common.subtotal")}</span>
                <span className="tabular text-fg">{formatMinorTHB(cart.subtotalMinor)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>{locale === "th" ? "ค่าธรรมเนียม" : "Fees"}</span>
                <span className="text-success">{locale === "th" ? "ฟรี" : "Free"}</span>
              </div>
              <p className="text-[11px] text-muted">
                {locale === "th" ? "ส่วนลดคูปองจะคำนวณในขั้นตอนถัดไป" : "Coupon discounts are applied on the next step."}
              </p>
              <Separator className="my-1" />
              <div className="flex items-baseline justify-between">
                <span className="font-semibold text-fg">{tr("common.total")}</span>
                <span className="tabular text-xl font-semibold text-fg">{formatMinorTHB(cart.subtotalMinor)}</span>
              </div>
            </div>

            <Link
              href={user ? "/checkout" : "/login?next=/checkout"}
              aria-disabled={cart.hasIssues}
              className={buttonClass({
                size: "lg",
                className: `mt-5 w-full ${cart.hasIssues ? "pointer-events-none opacity-50" : ""}`,
              })}
            >
              {user ? tr("cart.checkout") : tr("cart.loginToCheckout")}
              <ArrowRight className="size-4" />
            </Link>

            <div className="mt-4 space-y-2 rounded-xl bg-surface-2 p-3 text-[11px] text-muted">
              <p className="flex items-center gap-2">
                <Wallet className="size-3.5 text-primary" />
                {locale === "th" ? "จ่ายด้วย Wallet หรือ PromptPay" : "Pay with wallet or PromptPay"}
              </p>
              <p className="flex items-center gap-2">
                <LockKeyhole className="size-3.5 text-primary" />
                {locale === "th" ? "ตรวจสอบราคาและสต็อกฝั่งเซิร์ฟเวอร์" : "Prices and stock verified server-side"}
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
