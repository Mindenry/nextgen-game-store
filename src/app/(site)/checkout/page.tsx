import Link from "next/link";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { AlertTriangle, ArrowLeft, MailCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDetailedCart } from "@/lib/cart";
import { getWallet } from "@/lib/wallet";
import { getPromptPayConfig, getSettings } from "@/lib/settings";
import { getEnabledProvider } from "@/lib/settings";
import { getLocale, translate } from "@/lib/i18n";
import { formatMinorTHB } from "@/lib/money";
import { Alert, buttonClass } from "@/components/ui";
import { ProductImage } from "@/components/product-card";
import { CheckoutForm } from "@/components/checkout-form";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const [cart, wallet, locale] = await Promise.all([getDetailedCart(), getWallet(user.id), getLocale()]);
  if (cart.items.length === 0) redirect("/cart");

  const [settings, promptConfig] = await Promise.all([getSettings(), getPromptPayConfig()]);
  const activeProvider = await getEnabledProvider(String(settings["payment.active_provider"] ?? "promptpay_qr"));
  const promptPayAvailable = Boolean(promptConfig.promptPayId) && Boolean(activeProvider?.is_enabled);
  const tr = (key: string) => translate(locale, key);

  return (
    <div className="container-page py-8 md:py-12">
      <Link href="/cart" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> {tr("cart.title")}
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Checkout step 2</p>
          <h1 className="mt-1 text-3xl font-semibold">{tr("checkout.title")}</h1>
        </div>
        <p className="text-xs text-muted">{cart.count} {locale === "th" ? "ชิ้น" : "items"}</p>
      </div>

      {!user.emailVerified ? (
        <Alert variant="warning" className="mt-5" title={locale === "th" ? "กรุณายืนยันอีเมล" : "Verify your email first"}>
          <p>
            {locale === "th"
              ? "เพื่อความปลอดภัยของคำสั่งซื้อ กรุณายืนยันอีเมลก่อนชำระเงิน"
              : "For the security of your orders, verify your email before checking out."}
          </p>
          <Link href="/dashboard/security" className={buttonClass({ variant: "outline", size: "sm", className: "mt-2" })}>
            <MailCheck className="size-3.5" /> {locale === "th" ? "ไปที่การตั้งค่าความปลอดภัย" : "Open security settings"}
          </Link>
        </Alert>
      ) : null}

      {cart.hasIssues ? (
        <Alert variant="danger" className="mt-5" title="Some items are unavailable">
          <p>Remove or update the affected items in your cart before placing the order.</p>
          <Link href="/cart" className="mt-1 inline-block text-xs font-semibold text-primary underline">
            Review cart
          </Link>
        </Alert>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px] lg:items-start">
        <div className="surface-card p-5">
          <h2 className="text-sm font-semibold">{tr("checkout.summary")}</h2>
          <div className="mt-4 space-y-3.5">
            {cart.items.map((item, index) => (
              <div key={`${item.productId}:${item.variantId ?? "base"}`} className="flex gap-3">
                <ProductImage
                  imageUrl={item.imageUrl}
                  name={item.name}
                  icon="Gamepad2"
                  index={index}
                  className="size-16 shrink-0 rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-fg">{item.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {item.quantity} × {formatMinorTHB(item.unitPriceMinor)}
                  </p>
                </div>
                <p className="tabular text-sm font-semibold text-fg">{formatMinorTHB(item.lineTotalMinor)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-surface-2 p-3.5 text-xs text-muted">
            <p className="font-semibold text-fg">{locale === "th" ? "การส่งมอบ" : "Delivery"}</p>
            <p className="mt-1">
              {locale === "th"
                ? "สินค้าดิจิทัลจะแสดงใน My Products หลังการชำระเงินได้รับการยืนยันแล้วเท่านั้น"
                : "Digital items appear in My Products only after payment is confirmed."}
            </p>
          </div>
          {!user.emailVerified ? (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-warning">
              <AlertTriangle className="size-3.5" /> Email verification required
            </p>
          ) : null}
        </div>

        <CheckoutForm
          subtotalMinor={cart.subtotalMinor}
          walletBalanceMinor={wallet.balanceMinor}
          promptPayAvailable={promptPayAvailable}
          idempotencyKey={randomUUID()}
          locale={locale}
          itemCount={cart.count}
          disabled={cart.hasIssues || !user.emailVerified}
        />
      </div>
    </div>
  );
}
