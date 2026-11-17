import { getSettings } from "@/lib/settings";
import { Card } from "@/components/ui";

export const metadata = { title: "Refund policy" };

export default async function RefundPage() {
  const settings = await getSettings();
  return (
    <div className="container-page max-w-3xl py-10">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Legal</p>
      <h1 className="mt-2 text-3xl font-semibold">Refund policy</h1>
      <p className="mt-1 text-sm text-muted">Digital goods, top-ups and wallet refunds.</p>
      <Card className="mt-6 p-6">
        <p className="whitespace-pre-line text-sm leading-relaxed text-fg-soft">{String(settings["legal.refund"] ?? "")}</p>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-xs text-muted">
          <li>Delivered digital accounts and keys cannot be returned once credentials are revealed.</li>
          <li>Failed or unfulfilled top-ups are reviewed and, where applicable, refunded to your wallet.</li>
          <li>Approved refunds are credited to your wallet balance and appear in your ledger.</li>
          <li>Wallet balance is non-transferable and non-withdrawable unless required by law.</li>
        </ul>
      </Card>
    </div>
  );
}
