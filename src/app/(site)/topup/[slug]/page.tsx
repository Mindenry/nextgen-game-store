import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { ArrowLeft, Gamepad2, Info, ShieldCheck } from "lucide-react";
import { getTopupGameBySlug } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/auth";
import { getWallet } from "@/lib/wallet";
import { getEnabledProvider, getPromptPayConfig, getSettings } from "@/lib/settings";
import { getLocale } from "@/lib/i18n";
import { buttonClass } from "@/components/ui";
import { TopupForm } from "@/components/topup-form";
import { safeJson } from "@/lib/utils";

type GameField = { key: string; label: string; labelEn?: string; placeholder?: string; help?: string; required?: boolean; pattern?: string };

export default async function TopupGamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getTopupGameBySlug(slug);
  if (!data) notFound();

  const user = await getCurrentUser();
  const [wallet, settings, promptConfig, locale] = await Promise.all([
    user ? getWallet(user.id) : Promise.resolve({ balance: "0.00", balanceMinor: 0, updatedAt: null }),
    getSettings(),
    getPromptPayConfig(),
    getLocale(),
  ]);
  const provider = await getEnabledProvider(String(settings["payment.active_provider"] ?? "promptpay_qr"));
  const promptPayAvailable = Boolean(promptConfig.promptPayId) && Boolean(provider?.is_enabled);
  const fields = safeJson<GameField[]>(data.game.fields, []).map((field) => ({
    ...field,
    label: locale === "en" && field.labelEn ? field.labelEn : field.label,
  }));

  return (
    <div className="container-page py-8 md:py-12">
      <Link href="/topup" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> All games
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/20 to-accent/10 text-primary">
          {data.game.logo_url ? (
             
            <img src={data.game.logo_url} alt={data.game.name} className="size-full object-cover" />
          ) : (
            <Gamepad2 className="size-6" />
          )}
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Game top-up</p>
          <h1 className="text-2xl font-semibold md:text-3xl">{data.game.name}</h1>
          <p className="text-xs text-muted">
            {data.products.length} {locale === "th" ? "แพ็กเกจ" : "packages"} · {locale === "th" ? "ตรวจสอบ UID ก่อนชำระ" : "UID verified before processing"}
          </p>
        </div>
      </div>

      {!user ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 text-sm">
          <p className="text-muted">
            {locale === "th" ? "เข้าสู่ระบบเพื่อใช้ Wallet และติดตามสถานะการเติม" : "Sign in to use your wallet and track fulfilment."}
          </p>
          <Link href={`/login?next=/topup/${slug}`} className={buttonClass({ size: "sm" })}>
            Sign in
          </Link>
        </div>
      ) : null}

      <div className="mt-7">
        {data.products.length === 0 || fields.length === 0 ? (
          <div className="surface-card p-10 text-center">
            <Info className="mx-auto size-5 text-warning" />
            <p className="mt-3 font-semibold">This game is not ready for orders yet</p>
            <p className="mt-1 text-sm text-muted">
              {fields.length === 0
                ? "Player fields are not configured."
                : "No packages are available."}{" "}
              Add them in Admin → Game Top-Up.
            </p>
            <Link href="/topup" className={buttonClass({ variant: "outline", className: "mt-4" })}>
              Back to games
            </Link>
          </div>
        ) : (
          <TopupForm
            gameSlug={slug}
            fields={fields}
            packages={data.products.map((product) => ({
              id: product.id,
              name: product.name,
              price: product.price,
              compare_at_price: product.compare_at_price,
              delivery_type: product.delivery_type,
            }))}
            walletBalanceMinor={wallet.balanceMinor}
            promptPayAvailable={promptPayAvailable}
            idempotencyKey={randomUUID()}
            locale={locale}
          />
        )}
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {[
          { title: "Server-verified price", body: "The package price is re-read from the catalogue at checkout." },
          { title: "Receipt & ledger", body: "Wallet payments create an auditable ledger entry instantly." },
          { title: "Manual review when needed", body: "If our provider cannot confirm, staff review the order." },
        ].map((item) => (
          <div key={item.title} className="surface-card flex items-start gap-2.5 p-4">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
            <div>
              <p className="text-xs font-semibold text-fg">{item.title}</p>
              <p className="mt-0.5 text-[11px] text-muted">{item.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
