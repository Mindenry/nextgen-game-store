import Link from "next/link";
import { AtSign, Clock, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { setLanguageAction } from "@/actions/account";
import { getLocale, translate } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { Brand } from "@/components/brand";

export async function SiteFooter() {
  const [settings, locale] = await Promise.all([getSettings(), getLocale()]);
  const tr = (key: string) => translate(locale, key);
  const name = String(settings["site.name"] ?? "NEXTGEN GAME STORE");
  const socials = [
    { key: "social.discord", label: "Discord" },
    { key: "social.facebook", label: "Facebook" },
    { key: "social.instagram", label: "Instagram" },
    { key: "social.line", label: "LINE" },
  ]
    .map((item) => ({ label: item.label, url: String(settings[item.key] ?? "") }))
    .filter((item) => item.url);

  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="container-page grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Brand />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
            {String(settings["footer.about"] ?? "")}
          </p>
          <div className="mt-5 space-y-2 text-sm text-muted">
            <p className="flex items-center gap-2">
              <Mail className="size-3.5 text-primary" />
              <a href={`mailto:${String(settings["contact.email"] ?? "")}`} className="hover:text-fg">
                {String(settings["contact.email"] ?? "")}
              </a>
            </p>
            <p className="flex items-center gap-2">
              <Phone className="size-3.5 text-primary" />
              {String(settings["contact.phone"] ?? "")}
            </p>
            <p className="flex items-center gap-2">
              <Clock className="size-3.5 text-primary" />
              {String(settings["contact.hours"] ?? "")}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="size-3.5 text-primary" />
              {String(settings["contact.address"] ?? "")}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-fg">{tr("footer.shop")}</p>
          <ul className="space-y-2 text-sm text-muted">
            {[
              { href: "/products", label: tr("nav.products") },
              { href: "/topup", label: tr("nav.topup") },
              { href: "/categories/game-accounts", label: tr("nav.accounts") },
              { href: "/products?sort=best_selling", label: tr("home.bestSellers") },
            ].map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition hover:text-fg">{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-fg">{tr("footer.account")}</p>
          <ul className="space-y-2 text-sm text-muted">
            {[
              { href: "/dashboard", label: tr("nav.dashboard") },
              { href: "/dashboard/wallet", label: tr("dashboard.wallet") },
              { href: "/dashboard/orders", label: tr("dashboard.orders") },
              { href: "/dashboard/support", label: tr("dashboard.support") },
            ].map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition hover:text-fg">{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-fg">{tr("footer.legal")}</p>
          <ul className="space-y-2 text-sm text-muted">
            {[
              { href: "/legal/terms", label: tr("footer.terms") },
              { href: "/legal/privacy", label: tr("footer.privacy") },
              { href: "/legal/refund", label: tr("footer.refund") },
              { href: "/dashboard/support", label: tr("nav.support") },
            ].map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition hover:text-fg">{link.label}</Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted">
            <ShieldCheck className="size-4 text-success" />
            {locale === "th" ? "ตรวจสอบทุกคำสั่งซื้อ" : "Every order verified"}
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} {name}. {tr("footer.rights")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-muted">{tr("footer.payments")}</span>
            {["PromptPay", "Bank Transfer", "Wallet"].map((method) => (
              <span key={method} className="rounded-md border border-border bg-surface-2 px-2 py-1 text-[10px] font-semibold text-fg-soft">
                {method}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {socials.map((social) => (
              <a
                key={social.label}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted transition hover:text-fg"
              >
                {social.label}
              </a>
            ))}
            <div className="flex items-center overflow-hidden rounded-lg border border-border">
              {(["th", "en"] as const).map((lang) => (
                <form key={lang} action={setLanguageAction}>
                  <input type="hidden" name="lang" value={lang} />
                  <button
                    type="submit"
                    className={`px-2 py-1 text-[10px] font-bold uppercase ${
                      locale === lang ? "bg-fg text-bg" : "bg-surface text-muted hover:text-fg"
                    }`}
                  >
                    {lang}
                  </button>
                </form>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
