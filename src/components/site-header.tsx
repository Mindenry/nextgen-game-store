import Link from "next/link";
import { ChevronDown, ShoppingCart, Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getCategories } from "@/lib/catalog";
import { cartCount } from "@/lib/cart";
import { getLocale, translate } from "@/lib/i18n";
import { getWallet } from "@/lib/wallet";
import { Brand } from "@/components/brand";
import { CategoryIcon } from "@/components/category-icon";
import { MobileMenu } from "@/components/mobile-menu";
import { SearchBox } from "@/components/search-box";
import { ThemeToggle } from "@/components/theme-provider";
import { UserMenu } from "@/components/user-menu";
import { buttonClass } from "@/components/ui";
import { formatTHB } from "@/lib/money";

export async function SiteHeader() {
  const [user, categories, count, locale] = await Promise.all([
    getCurrentUser(),
    getCategories(true),
    cartCount(),
    getLocale(),
  ]);
  const wallet = user ? await getWallet(user.id) : null;
  const tr = (key: string) => translate(locale, key);
  const topCategories = categories.slice(0, 8).map((category) => ({
    slug: category.slug,
    name: locale === "th" ? category.name_th : category.name_en,
    icon: category.icon,
  }));

  return (
    <header className="sticky top-0 z-50">
      <div className="bg-fg text-bg">
        <div className="container-page flex h-8 items-center justify-between gap-4 text-[11px] font-medium">
          <p className="truncate opacity-85">
            {locale === "th"
              ? "ส่งมอบอัตโนมัติ · กระเป๋าเงินปลอดภัย · ชำระผ่าน PromptPay"
              : "Automatic delivery · Secure wallet · PromptPay ready"}
          </p>
          <Link href="/products?sort=latest" className="hidden shrink-0 opacity-85 hover:opacity-100 sm:block">
            {locale === "th" ? "สินค้าเข้าใหม่ →" : "New arrivals →"}
          </Link>
        </div>
      </div>

      <div className="glass border-b border-border">
        <div className="container-page flex h-16 items-center gap-3 md:gap-5">
          <MobileMenu categories={topCategories} loggedIn={Boolean(user)} />
          <Brand className="shrink-0" />

          <div className="hidden flex-1 items-center gap-1 lg:flex">
            <Link href="/products" className="rounded-lg px-2.5 py-2 text-sm font-medium text-fg-soft transition hover:bg-surface-2 hover:text-fg">
              {tr("nav.products")}
            </Link>
            <div className="group relative">
              <button type="button" className="flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-medium text-fg-soft transition hover:bg-surface-2 hover:text-fg">
                {tr("nav.categories")}
                <ChevronDown className="size-3.5 text-muted transition group-hover:rotate-180" />
              </button>
              <div className="invisible absolute left-0 top-full w-[520px] translate-y-1 rounded-2xl border border-border bg-card p-2 opacity-0 shadow-[var(--shadow-lg)] transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                <div className="grid grid-cols-2 gap-1">
                  {topCategories.map((category) => (
                    <Link
                      key={category.slug}
                      href={`/categories/${category.slug}`}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-fg-soft transition hover:bg-surface-2 hover:text-fg"
                    >
                      <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                        <CategoryIcon name={category.icon} className="size-4" />
                      </span>
                      {category.name}
                    </Link>
                  ))}
                </div>
                <Link href="/products" className="mt-1 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5 text-xs font-semibold text-fg">
                  Browse every category <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
            <Link href="/topup" className="rounded-lg px-2.5 py-2 text-sm font-medium text-fg-soft transition hover:bg-surface-2 hover:text-fg">
              {tr("nav.topup")}
            </Link>
            <Link href="/categories/game-accounts" className="rounded-lg px-2.5 py-2 text-sm font-medium text-fg-soft transition hover:bg-surface-2 hover:text-fg">
              {tr("nav.accounts")}
            </Link>
          </div>

          <div className="hidden max-w-md flex-1 md:block">
            <SearchBox placeholder={tr("nav.searchPlaceholder")} />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle className="hidden sm:inline-flex" />
            {user ? (
              <Link
                href="/dashboard/wallet"
                className="hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-fg transition hover:border-primary/35 sm:flex"
              >
                <Wallet className="size-3.5 text-primary" />
                <span className="tabular">{formatTHB(wallet?.balance ?? "0")}</span>
              </Link>
            ) : null}
            <Link
              href="/dashboard/wallet/topup"
              className={buttonClass({ size: "sm", className: "hidden sm:inline-flex" })}
            >
              {tr("nav.topUp")}
            </Link>
            <Link
              href="/cart"
              aria-label={tr("nav.cart")}
              className="focus-ring relative grid size-9 place-items-center rounded-xl border border-border bg-surface text-fg transition hover:border-primary/35 hover:text-primary"
            >
              <ShoppingCart className="size-4" />
              {count > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-fg">
                  {count > 99 ? "99+" : count}
                </span>
              ) : null}
            </Link>
            {user ? (
              <UserMenu
                displayName={user.displayName}
                email={user.email}
                roleId={user.roleId}
                avatarUrl={user.avatarUrl}
              />
            ) : (
              <div className="hidden items-center gap-1.5 sm:flex">
                <Link href="/login" className={buttonClass({ variant: "ghost", size: "sm" })}>
                  {tr("nav.signIn")}
                </Link>
                <Link href="/register" className={buttonClass({ variant: "outline", size: "sm" })}>
                  {tr("nav.signUp")}
                </Link>
              </div>
            )}
          </div>
        </div>
        <div className="container-page pb-3 md:hidden">
          <SearchBox placeholder={tr("nav.searchPlaceholder")} />
        </div>
      </div>
    </header>
  );
}
