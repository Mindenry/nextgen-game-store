import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-6">
      <div className="surface-card max-w-md p-8 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted">
          The page you are looking for does not exist, or the product was removed from the store.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg">
            Home
          </Link>
          <Link href="/products" className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">
            Products
          </Link>
        </div>
      </div>
    </div>
  );
}
