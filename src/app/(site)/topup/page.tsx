import Link from "next/link";
import { ArrowRight, CheckCircle2, Gamepad2, Info, Search, Zap } from "lucide-react";
import { getTopupGames } from "@/lib/catalog";
import { getLocale } from "@/lib/i18n";
import { Badge, buttonClass, SectionHeading } from "@/components/ui";

export const metadata = { title: "Game top-up" };

export default async function TopupPage() {
  const [games, locale] = await Promise.all([getTopupGames(), getLocale()]);

  return (
    <div className="container-page py-8 md:py-12">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-fg p-7 text-bg md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_srgb,var(--primary)_65%,transparent),transparent_55%)] opacity-75" />
        <div className="relative max-w-2xl">
          <Badge tone="outline" className="!border-white/20 !text-bg">
            <Zap className="size-3" /> Instant top-up
          </Badge>
          <h1 className="mt-3 text-3xl font-semibold md:text-4xl">
            {locale === "th" ? "เติมเกมที่คุณเล่น" : "Top up the games you play"}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed opacity-75">
            {locale === "th"
              ? "เลือกเกม กรอก Player ID และแพ็กเกจที่ต้องการ ชำระด้วย Wallet หรือ PromptPay ระบบจะบันทึกคำสั่งซื้อและติดตามสถานะให้ทุกขั้นตอน"
              : "Pick a game, enter your player details and choose a package. Pay with your wallet or PromptPay and track every step of fulfilment."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#games" className={buttonClass({ className: "!bg-primary !text-primary-fg" })}>
              {locale === "th" ? "เลือกเกม" : "Choose a game"} <ArrowRight className="size-4" />
            </a>
            <Link href="/dashboard/wallet" className={buttonClass({ variant: "outline", className: "!border-white/25 !bg-transparent !text-bg hover:!bg-white/10" })}>
              {locale === "th" ? "เช็กยอด Wallet" : "Check wallet balance"}
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { title: "1. Choose game & package", body: "Prices are loaded from the server catalogue." },
          { title: "2. Enter player details", body: "Fields adapt per game — UID, server or region." },
          { title: "3. Paid & processed", body: "Wallet instantly, or PromptPay after verification." },
        ].map((step) => (
          <div key={step.title} className="surface-card flex items-start gap-3 p-4">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
            <div>
              <p className="text-xs font-semibold text-fg">{step.title}</p>
              <p className="mt-0.5 text-[11px] text-muted">{step.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div id="games" className="mt-10 scroll-mt-24">
        <SectionHeading
          title={locale === "th" ? "เกมทั้งหมด" : "All games"}
          description={locale === "th" ? "กดเลือกเกมเพื่อกรอกข้อมูลและเลือกแพ็กเกจ" : "Open a game to enter your details and pick a package."}
        />
        {games.length === 0 ? (
          <div className="surface-card p-10 text-center">
            <Gamepad2 className="mx-auto size-6 text-primary" />
            <p className="mt-3 font-semibold">No games configured yet</p>
            <p className="mt-1 text-sm text-muted">Add games and packages in Admin → Game Top-Up.</p>
            <Link href="/admin/topup" className={buttonClass({ className: "mt-4" })}>Open top-up manager</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {games.map((game, index) => (
              <Link
                key={game.id}
                href={`/topup/${game.slug}`}
                className="group surface-card overflow-hidden transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-md)]"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-primary/15 via-surface-2 to-accent/10">
                  <div className="absolute inset-0 grid place-items-center">
                    {game.logo_url ? (
                       
                      <img src={game.logo_url} alt={game.name} className="size-full object-cover transition group-hover:scale-[1.03]" />
                    ) : (
                      <span className="grid size-12 place-items-center rounded-2xl bg-fg/90 text-lg font-bold text-bg">
                        {game.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <Badge tone="neutral" className="absolute right-2 top-2 !bg-black/50 !text-white">
                    {game.product_count} packs
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2 p-3.5">
                  <div>
                    <p className="text-sm font-semibold text-fg">{game.name}</p>
                    <p className="text-[11px] text-muted">{locale === "th" ? "เติมทันที" : "Instant packages"}</p>
                  </div>
                  <ArrowRight className="size-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-10 flex items-start gap-3 rounded-2xl border border-border bg-surface p-5 text-xs text-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          {locale === "th"
            ? "กรุณาตรวจสอบ Player ID และ Server ให้ถูกต้องก่อนชำระเงิน เนื่องจากไม่สามารถแก้ไขหรือคืนเงินได้หลังจากเริ่มดำเนินการเติมแล้ว"
            : "Double-check your Player ID and server before paying. Top-ups cannot be edited or refunded once processing has started."}
        </p>
      </div>
    </div>
  );
}
