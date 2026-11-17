import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  CreditCard,
  Headphones,
  LockKeyhole,
  QrCode,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Wallet,
  Zap,
} from "lucide-react";
import { getHomeData, getLatestReviews, homepageStats } from "@/lib/catalog";
import { getLocale, translate, localizedName } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { formatNumber, formatTHB } from "@/lib/money";
import { Badge, buttonClass, SectionHeading } from "@/components/ui";
import { CategoryIcon } from "@/components/category-icon";
import { ProductCard, ProductGrid, ProductImage } from "@/components/product-card";
import { Reveal, Stagger, StaggerItem } from "@/components/reveal";

const FAQS = [
  {
    th: { q: "ได้รับสินค้าเมื่อไหร่?", a: "สินค้าดิจิทัลแบบส่งอัตโนมัติจะแสดงใน My Products ทันทีหลังชำระเงิน สำเร็จ ส่วนงานที่ต้องใช้ทีมงานจะถูกดำเนินการภายในเวลาทำการ" },
    en: { q: "When do I receive my product?", a: "Automatically delivered digital items appear in My Products the moment payment is confirmed. Manual deliveries are handled by our team during support hours." },
  },
  {
    th: { q: "ชำระเงินด้วยวิธีไหนได้บ้าง?", a: "คุณสามารถจ่ายด้วยยอดเงินใน Wallet หรือสแกน PromptPay QR ยอดเงินจะถูกตรวจสอบฝั่งเซิร์ฟเวอร์ทุกครั้ง" },
    en: { q: "Which payment methods are supported?", a: "Pay from your wallet balance or scan a PromptPay QR. Every payment is verified server-side before delivery." },
  },
  {
    th: { q: "ถ้าเติมเงินแล้วยอดไม่เข้า?", a: "แนบสลิปในหน้าชำระเงินเพื่อให้ทีมงานตรวจสอบ ระบบจะไม่ขึ้นว่าชำระสำเร็จจนกว่าจะได้รับการยืนยันจริง" },
    en: { q: "What if my top-up does not arrive?", a: "Attach your slip on the payment page and staff will verify it. The system never marks a payment as complete without confirmation." },
  },
  {
    th: { q: "ขอคืนเงินได้ไหม?", a: "สินค้าดิจิทัลที่ส่งมอบแล้วไม่สามารถคืนได้ แต่หากสินค้ามีปัญหาและเราไม่สามารถแก้ไขได้ ทีมงานจะพิจารณาคืนเงินตามนโยบายร้านค้า" },
    en: { q: "Can I get a refund?", a: "Delivered digital goods are non-returnable, but if something is wrong and we cannot fix it, our team will review a refund according to the store policy." },
  },
];

export default async function HomePage() {
  const [home, stats, reviews, settings, locale] = await Promise.all([
    getHomeData(),
    homepageStats(),
    getLatestReviews(6),
    getSettings(),
    getLocale(),
  ]);
  const tr = (key: string) => translate(locale, key);
  const hero = home.banners[0];
  const showcase = [...home.featured, ...home.newArrivals].slice(0, 3);
  const categories = home.categories;

  return (
    <>
      {/* ---------------------------------------------------------------- HERO */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_srgb,var(--primary)_16%,transparent),transparent_55%)]" />
        <div className="grid-pattern absolute inset-0 opacity-60" />
        <div className="container-page relative grid gap-12 py-14 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:py-20">
          <div>
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1.5 text-[11px] font-semibold text-fg-soft shadow-sm backdrop-blur">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-70" />
                  <span className="relative inline-flex size-2 rounded-full bg-success" />
                </span>
                {tr("home.heroEyebrow")}
              </div>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="mt-5 text-[38px] font-semibold leading-[1.04] tracking-tight text-fg sm:text-5xl lg:text-[58px]">
                {hero?.title ?? tr("home.heroTitle1")}
                <span className="text-gradient block">
                  {hero?.subtitle ?? tr("home.heroTitle2")}
                </span>
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
                {String(settings["site.description"] ?? tr("home.heroBody"))}
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href={hero?.cta_url || "/products"} className={buttonClass({ size: "lg" })}>
                  {hero?.cta_label || tr("home.browseProducts")}
                  <ArrowRight className="size-4" />
                </Link>
                <Link href="/topup" className={buttonClass({ variant: "outline", size: "lg" })}>
                  <Zap className="size-4 text-primary" />
                  {tr("home.topUpNow")}
                </Link>
              </div>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="mt-9 grid max-w-lg grid-cols-3 gap-4 border-t border-border pt-5">
                {[
                  { value: formatNumber(stats.products), label: locale === "th" ? "สินค้าพร้อมขาย" : "Products live" },
                  { value: formatNumber(stats.orders), label: locale === "th" ? "คำสั่งซื้อสำเร็จ" : "Orders fulfilled" },
                  { value: formatNumber(stats.customers), label: locale === "th" ? "สมาชิก" : "Members" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="tabular text-xl font-semibold text-fg">{stat.value}</p>
                    <p className="mt-0.5 text-[11px] text-muted">{stat.label}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Hero visual — pure CSS, no external assets */}
          <Reveal delay={0.15} className="relative hidden lg:block">
            <div className="relative mx-auto aspect-square w-full max-w-[500px]">
              <div className="absolute inset-6 rounded-[2.2rem] border border-border/80 bg-surface shadow-[var(--shadow-lg)]">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-danger/60" />
                    <span className="size-2 rounded-full bg-warning/60" />
                    <span className="size-2 rounded-full bg-success/60" />
                  </div>
                  <Badge tone="success" className="gap-1">
                    <ShieldCheck className="size-3" /> Secure checkout
                  </Badge>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                        {locale === "th" ? "กระเป๋าเงิน" : "Your wallet"}
                      </p>
                      <p className="tabular mt-1 text-3xl font-semibold">{formatTHB("1250.00")}</p>
                    </div>
                    <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                      <Wallet className="size-5" />
                    </span>
                  </div>
                  <div className="mt-5 space-y-2.5">
                    {showcase.length > 0
                      ? showcase.map((product, index) => (
                          <Link
                            key={product.id}
                            href={`/products/${product.slug}`}
                            className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/70 p-2.5 transition hover:border-primary/35"
                          >
                            <ProductImage
                              imageUrl={product.image_url}
                              name={product.name_en}
                              icon={product.category_icon}
                              index={index}
                              className="size-11 shrink-0 rounded-lg"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-fg">{product.name_en}</p>
                              <p className="text-[10px] text-muted">
                                {product.delivery_method === "auto" ? "Instant" : "Manual"} · {product.sold_count} sold
                              </p>
                            </div>
                            <p className="tabular text-xs font-semibold text-fg">{formatTHB(product.price)}</p>
                          </Link>
                        ))
                      : Array.from({ length: 3 }).map((_, index) => (
                          <div key={index} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/70 p-2.5">
                            <div className="size-11 rounded-lg bg-primary/10" />
                            <div className="flex-1">
                              <div className="h-2.5 w-2/3 rounded-full bg-border" />
                              <div className="mt-1.5 h-2 w-1/3 rounded-full bg-border/70" />
                            </div>
                          </div>
                        ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-fg px-3.5 py-3 text-bg">
                    <span className="flex items-center gap-2 text-[11px] font-medium">
                      <QrCode className="size-3.5" /> PromptPay ready
                    </span>
                    <span className="text-[11px] font-bold">฿ THB</span>
                  </div>
                </div>
              </div>

              <div className="animate-float absolute -left-4 top-10 rounded-2xl border border-border bg-card p-3.5 shadow-[var(--shadow-md)]">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-xl bg-success/12 text-success">
                    <BadgeCheck className="size-4" />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold text-fg">Payment verified</p>
                    <p className="text-[9px] text-muted">Server-side ledger</p>
                  </div>
                </div>
              </div>
              <div className="animate-float absolute -right-2 bottom-14 rounded-2xl border border-border bg-card p-3.5 shadow-[var(--shadow-md)] [animation-delay:1.5s]">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Rocket className="size-4" />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold text-fg">Instant delivery</p>
                    <p className="text-[9px] text-muted">Avg. under 60 seconds</p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="relative border-t border-border bg-surface/60">
          <div className="container-page grid grid-cols-2 divide-border md:grid-cols-4 md:divide-x">
            {[
              { icon: Zap, title: tr("home.trustInstant"), body: locale === "th" ? "สินค้าดิจิทัลพร้อมใช้" : "Digital goods, ready now" },
              { icon: LockKeyhole, title: tr("home.trustSecure"), body: locale === "th" ? "ตรวจสอบทุกธุรกรรม" : "Ledger-backed payments" },
              { icon: Headphones, title: tr("home.trustSupport"), body: locale === "th" ? "ทีมงานพร้อมช่วย" : "Tickets, every day" },
              { icon: BadgeCheck, title: tr("home.trustVerified"), body: locale === "th" ? "คัดสรรก่อนขาย" : "Checked before listing" },
            ].map((item) => (
              <div key={item.title} className="flex items-center gap-3 px-1 py-4 md:px-6">
                <item.icon className="size-4 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-fg">{item.title}</p>
                  <p className="text-[10px] text-muted">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- CATEGORIES */}
      <section className="container-page py-14">
        <SectionHeading
          eyebrow={locale === "th" ? "เลือกตามหมวดหมู่" : "Explore"}
          title={tr("home.categories")}
          description={tr("home.categoriesSub")}
          action={
            <Link href="/products" className={buttonClass({ variant: "ghost", size: "sm" })}>
              {tr("common.viewAll")} <ChevronRight className="size-3.5" />
            </Link>
          }
        />
        <Stagger className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {categories.map((category) => (
            <StaggerItem key={category.id}>
              <Link
                href={`/categories/${category.slug}`}
                className="group surface-card flex h-full flex-col gap-3 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-md)]"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-fg">
                  <CategoryIcon name={category.icon} className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-fg">{localizedName(category, locale)}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {category.product_count ?? 0} {locale === "th" ? "รายการ" : "items"}
                  </p>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ------------------------------------------------------------- FEATURED */}
      <section className="border-y border-border bg-surface/50 py-14">
        <div className="container-page">
          <SectionHeading
            eyebrow="Featured"
            title={tr("home.featured")}
            description={tr("home.featuredSub")}
            action={
              <Link href="/products?sort=popular" className={buttonClass({ variant: "ghost", size: "sm" })}>
                {tr("common.viewAll")} <ChevronRight className="size-3.5" />
              </Link>
            }
          />
          {home.featured.length > 0 ? (
            <ProductGrid products={home.featured.slice(0, 8)} />
          ) : (
            <div className="surface-card p-10 text-center">
              <Sparkles className="mx-auto size-6 text-primary" />
              <p className="mt-3 font-semibold">Your storefront is ready</p>
              <p className="mt-1 text-sm text-muted">
                Add your first products in the admin dashboard to fill this section.
              </p>
              <Link href="/admin/products" className={buttonClass({ className: "mt-4" })}>
                Open product manager
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ----------------------------------------------------------- PROMOTIONS */}
      {home.promotions.length > 0 ? (
        <section className="container-page py-14">
          <SectionHeading
            eyebrow="Offers"
            title={tr("home.promotions")}
            action={
              <Link href="/products" className={buttonClass({ variant: "ghost", size: "sm" })}>
                {tr("common.shopNow")} <ChevronRight className="size-3.5" />
              </Link>
            }
          />
          <div className="grid gap-4 md:grid-cols-3">
            {home.promotions.map((promo, index) => (
              <Link
                key={promo.id}
                href={promo.cta_url || "/products"}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_60%)]" />
                {promo.badge ? <Badge tone="primary">{promo.badge}</Badge> : null}
                <h3 className="relative mt-3 text-xl font-semibold text-fg">{promo.title}</h3>
                {promo.subtitle ? <p className="relative mt-1.5 text-sm text-muted">{promo.subtitle}</p> : null}
                <span className="relative mt-6 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  {promo.cta_label || tr("common.shopNow")} <ArrowRight className="size-3.5" />
                </span>
                <span className="absolute -bottom-8 -right-6 text-8xl font-black text-fg/[0.04]">
                  0{index + 1}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------- BEST SELLERS */}
      <section className="container-page py-4">
        <SectionHeading
          eyebrow="Trending"
          title={tr("home.bestSellers")}
          description={tr("home.bestSellersSub")}
          action={
            <Link href="/products?sort=best_selling" className={buttonClass({ variant: "ghost", size: "sm" })}>
              {tr("common.viewAll")} <ChevronRight className="size-3.5" />
            </Link>
          }
        />
        <ProductGrid products={home.bestSellers.slice(0, 4)} />
      </section>

      {/* ---------------------------------------------------------- NEW ARRIVALS */}
      <section className="container-page py-10">
        <SectionHeading
          eyebrow="Fresh"
          title={tr("home.newArrivals")}
          description={tr("home.newArrivalsSub")}
          action={
            <Link href="/products?sort=latest" className={buttonClass({ variant: "ghost", size: "sm" })}>
              {tr("common.viewAll")} <ChevronRight className="size-3.5" />
            </Link>
          }
        />
        <ProductGrid products={home.newArrivals.slice(0, 4)} />
      </section>

      {/* -------------------------------------------------------------- HOW TO BUY */}
      <section className="border-y border-border bg-surface/50 py-14">
        <div className="container-page">
          <SectionHeading
            eyebrow="Simple by design"
            title={tr("home.howToBuy")}
            description={tr("home.howToBuySub")}
          />
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { icon: Sparkles, title: tr("home.step1Title"), body: tr("home.step1Body") },
              { icon: BadgeCheck, title: tr("home.step2Title"), body: tr("home.step2Body") },
              { icon: CreditCard, title: tr("home.step3Title"), body: tr("home.step3Body") },
              { icon: Zap, title: tr("home.step4Title"), body: tr("home.step4Body") },
            ].map((step, index) => (
              <div key={step.title} className="surface-card relative p-5">
                <span className="absolute right-4 top-4 text-[10px] font-bold text-muted">0{index + 1}</span>
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <step.icon className="size-5" />
                </span>
                <p className="mt-4 text-sm font-semibold text-fg">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- PAYMENTS */}
      <section className="container-page grid gap-8 py-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <SectionHeading
            eyebrow="Trust"
            title={tr("home.paymentMethods")}
            description={tr("home.paymentMethodsSub")}
            className="mb-0"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: Wallet, title: "Wallet", body: locale === "th" ? "จ่ายทันทีด้วยยอดคงเหลือ" : "Pay instantly from your balance" },
            { icon: QrCode, title: "PromptPay", body: locale === "th" ? "สแกน QR พร้อมรหัสอ้างอิง" : "Scan a QR with a unique reference" },
            { icon: LockKeyhole, title: "Verified", body: locale === "th" ? "ตรวจสอบฝั่งเซิร์ฟเวอร์" : "Server-side verification" },
          ].map((method) => (
            <div key={method.title} className="surface-card p-5">
              <method.icon className="size-5 text-primary" />
              <p className="mt-3 text-sm font-semibold">{method.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{method.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------------- REVIEWS */}
      {reviews.length > 0 ? (
        <section className="border-y border-border bg-surface/50 py-14">
          <div className="container-page">
            <SectionHeading eyebrow="Social proof" title={tr("home.reviews")} description={tr("home.reviewsSub")} />
            <div className="grid gap-4 md:grid-cols-3">
              {reviews.slice(0, 3).map((review) => (
                <figure key={review.id} className="surface-card p-5">
                  <div className="flex items-center gap-0.5 text-warning">
                    {Array.from({ length: review.rating }).map((_, index) => (
                      <Star key={index} className="size-3.5 fill-current" />
                    ))}
                  </div>
                  <blockquote className="mt-3 text-sm leading-relaxed text-fg-soft">
                    “{review.body || review.title || "Great experience."}”
                  </blockquote>
                  <figcaption className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-xs font-semibold text-fg">{review.display_name}</span>
                    <Link href={`/products/${review.product_slug}`} className="max-w-[50%] truncate text-[11px] text-muted hover:text-primary">
                      {review.product_name}
                    </Link>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------------------ FAQ */}
      <section className="container-page grid gap-10 py-14 lg:grid-cols-[0.7fr_1.3fr]">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">FAQ</p>
          <h2 className="mt-2 text-2xl font-semibold">{tr("home.faq")}</h2>
          <p className="mt-2 text-sm text-muted">
            {locale === "th"
              ? "หากยังไม่พบคำตอบ ทีมงานพร้อมช่วยเหลือผ่าน Ticket"
              : "Can't find your answer? Our team is one ticket away."}
          </p>
          <Link href="/dashboard/support" className={buttonClass({ variant: "outline", size: "sm", className: "mt-5" })}>
            {tr("home.contactCta")}
          </Link>
        </div>
        <div className="space-y-2.5">
          {FAQS.map((faq) => {
            const item = locale === "th" ? faq.th : faq.en;
            return (
              <details key={item.q} className="group surface-card px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-fg">
                  {item.q}
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border text-muted transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
              </details>
            );
          })}
        </div>
      </section>

      {/* --------------------------------------------------------------- CONTACT */}
      <section className="container-page pb-16">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-fg px-6 py-10 text-bg md:px-12 md:py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,color-mix(in_srgb,var(--primary)_55%,transparent),transparent_50%)] opacity-70" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold md:text-3xl">{tr("home.contact")}</h2>
              <p className="mt-2 max-w-lg text-sm opacity-75">{tr("home.contactBody")}</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link href="/dashboard/support" className={buttonClass({ className: "!bg-primary !text-primary-fg" })}>
                <Headphones className="size-4" /> {tr("home.contactCta")}
              </Link>
              <a href={`mailto:${String(settings["contact.email"] ?? "")}`} className={buttonClass({ variant: "outline", className: "!border-white/25 !bg-transparent !text-bg hover:!bg-white/10" })}>
                Email us
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
