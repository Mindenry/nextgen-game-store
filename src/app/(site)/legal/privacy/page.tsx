import { getSettings } from "@/lib/settings";
import { Card } from "@/components/ui";

export const metadata = { title: "Privacy policy" };

export default async function PrivacyPage() {
  const settings = await getSettings();
  return (
    <div className="container-page max-w-3xl py-10">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Legal</p>
      <h1 className="mt-2 text-3xl font-semibold">Privacy policy</h1>
      <p className="mt-1 text-sm text-muted">How your account, wallet and delivery data is handled.</p>
      <Card className="mt-6 p-6">
        <p className="whitespace-pre-line text-sm leading-relaxed text-fg-soft">{String(settings["legal.privacy"] ?? "")}</p>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-xs text-muted">
          <li>Account data is stored in the store database and protected by server-side authorization.</li>
          <li>Delivered product credentials are encrypted at rest and visible only to you and authorised staff.</li>
          <li>Payment slips are private and accessible only to you and finance staff.</li>
          <li>We never store card numbers; PromptPay QR payments are handled by your banking app.</li>
        </ul>
      </Card>
    </div>
  );
}
