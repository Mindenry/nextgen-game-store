import { getSettings } from "@/lib/settings";
import { Card } from "@/components/ui";

export const metadata = { title: "Terms of service" };

export default async function TermsPage() {
  const settings = await getSettings();
  return (
    <div className="container-page max-w-3xl py-10">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Legal</p>
      <h1 className="mt-2 text-3xl font-semibold">Terms of service</h1>
      <p className="mt-1 text-sm text-muted">Last updated by the store owner. Please review before purchasing.</p>
      <Card className="mt-6 p-6">
        <p className="whitespace-pre-line text-sm leading-relaxed text-fg-soft">{String(settings["legal.terms"] ?? "")}</p>
      </Card>
    </div>
  );
}
