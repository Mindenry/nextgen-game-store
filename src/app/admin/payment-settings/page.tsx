import Link from "next/link";
import { CheckCircle2, ExternalLink, QrCode, ShieldAlert, ShieldCheck } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { getSettings, getPromptPayConfig } from "@/lib/settings";
import { getSlipConfig } from "@/lib/slip-verification";
import { listPaymentProviders } from "@/lib/admin";
import { buildPromptPayPayload } from "@/lib/payments/promptpay";
import { qrDataUrl } from "@/lib/payments";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import { savePaymentSettingsAction, saveSlipSettingsAction } from "@/actions/admin-finance";
import { Alert, Badge, Card, Input, Select } from "@/components/ui";

export const metadata = { title: "Payment settings" };

export default async function PaymentSettingsPage() {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.settingsManage)) return <AccessDenied permission={PERMISSIONS.settingsManage} />;

  const [settings, promptConfig, slipConfig, providers] = await Promise.all([
    getSettings(),
    getPromptPayConfig(),
    getSlipConfig(),
    listPaymentProviders(),
  ]);
  const enabledProviders = providers.filter((provider) => provider.is_enabled);
  const str = (key: string) => String(settings[key] ?? "");
  const promptPayId = promptConfig.promptPayId;

  let testQr: string | null = null;
  let qrError: string | null = null;
  if (promptPayId) {
    try {
      const payload = buildPromptPayPayload({
        promptPayId,
        amountMinor: 100,
        reference: "TESTQR1",
      });
      testQr = await qrDataUrl(payload);
    } catch (error) {
      qrError = error instanceof Error ? error.message : "PromptPay ID is invalid.";
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Payments"
        title="Payment settings"
        description="ตั้งค่า PromptPay ID, ยอดเติมขั้นต่ำ และการตรวจสอบสลิปอัตโนมัติ (SlipOK) ทั้งหมดอยู่ในหน้านี้"
        actions={
          <Link href="/admin/payment-providers" className="text-xs font-semibold text-primary hover:underline">
            จัดการผู้ให้บริการชำระเงิน →
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">PromptPay QR</p>
          <div className="mt-1 flex items-center gap-2">
            {promptPayId && !qrError ? (
              <Badge tone="success"><CheckCircle2 className="size-3" /> พร้อมใช้งาน</Badge>
            ) : (
              <Badge tone="warning">ยังไม่ได้ตั้งค่า</Badge>
            )}
          </div>
          <p className="mt-2 truncate font-mono text-[11px] text-muted">{promptPayId || "ยังไม่มี PromptPay ID"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Slip verification</p>
          <div className="mt-1 flex items-center gap-2">
            {slipConfig.enabled && slipConfig.hasApiKey ? (
              <Badge tone="success"><ShieldCheck className="size-3" /> SlipOK พร้อมตรวจ</Badge>
            ) : (
              <Badge tone="warning">ตรวจสลิปด้วยคนเท่านั้น</Badge>
            )}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            {slipConfig.enabled && slipConfig.hasApiKey
              ? slipConfig.autoApprove
                ? "ตรวจสลิปกับธนาคารและเติมเงินอัตโนมัติ"
                : "ตรวจสลิปอัตโนมัติ แต่รอแอดมินอนุมัติ"
              : "ยังไม่มี API Key — ระบบจะไม่เติมเงินจนกว่าแอดมินตรวจสอบ"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">ยอดเติมขั้นต่ำ</p>
          <p className="tabular mt-1 text-lg font-semibold text-fg">฿{promptConfig.minDeposit.toFixed(2)}</p>
          <p className="mt-1 text-[11px] text-muted">สูงสุด ฿{promptConfig.maxDeposit.toLocaleString()} · QR หมดอายุ {promptConfig.expiryMinutes} นาที</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr] xl:items-start">
        <div className="space-y-4">
          <Card className="p-5" id="promptpay">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <QrCode className="size-4 text-primary" /> PromptPay QR
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              ใส่ <strong className="text-fg">เบอร์โทรศัพท์ที่ผูก PromptPay</strong> (10 หลัก) หรือ{" "}
              <strong className="text-fg">เลขบัตรประชาชน 13 หลัก</strong> หรือ e-Wallet 15 หลัก
              ระบบจะสร้าง QR ให้เองด้วยยอดเงินจริงและรหัสอ้างอิงเฉพาะทุกครั้ง
            </p>
            <Alert variant="info" className="mt-3">
              <p className="text-[11px] leading-relaxed">
                <strong>หา PromptPay ID ได้ที่:</strong> แอปธนาคาร (KBank) → PromptPay → รับเงิน/ตั้งค่าพร้อมเพย์
                จะแสดงเบอร์โทรหรือเลขบัตรประชาชนที่ลงทะเบียนไว้ ใช้หมายเลขนั้นได้เลย
              </p>
            </Alert>

            <div className="mt-4">
              <AdminActionForm action={savePaymentSettingsAction} submitLabel="บันทึกการตั้งค่า PromptPay">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-fg-soft">
                    PromptPay ID (เบอร์โทร / เลขบัตรประชาชน) <span className="text-danger">*</span>
                  </label>
                  <Input
                    name="promptPayId"
                    defaultValue={str("payment.promptpay_id")}
                    placeholder="เช่น 0812345678 หรือ 1234567890123"
                    inputMode="numeric"
                  />
                  <p className="mt-1 text-[10px] text-muted">ระบบจะตัดขีด/ช่องว่างออกให้อัตโนมัติ และตรวจสอบความยาวก่อนบันทึก</p>
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-[11px] font-semibold text-fg-soft">ชื่อบัญชีผู้รับ (แสดงในระบบ)</label>
                  <Input name="receiverName" defaultValue={str("payment.receiver_name")} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-fg-soft">เติมขั้นต่ำ (บาท)</label>
                    <Input name="minDeposit" type="number" min="1" step="0.01" defaultValue={str("payment.min_deposit")} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-fg-soft">เติมสูงสุด (บาท)</label>
                    <Input name="maxDeposit" type="number" min="1" step="0.01" defaultValue={str("payment.max_deposit")} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-fg-soft">QR หมดอายุ (นาที)</label>
                    <Input name="qrExpiry" type="number" min="1" max="1440" defaultValue={str("payment.qr_expiry_minutes")} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-[11px] font-semibold text-fg-soft">ช่องทางที่ใช้งาน</label>
                  <Select name="activeProvider" defaultValue={str("payment.active_provider")}>
                    {enabledProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>{provider.name}</option>
                    ))}
                  </Select>
                </div>
              </AdminActionForm>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-success" /> ตรวจสลิปอัตโนมัติ (SlipOK)
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              ใช้บริการตรวจสลิปของธนาคารผ่าน SlipOK เพื่อตรวจว่า <strong className="text-fg">สลิปจริง ไม่ซ้ำ ยอดตรง และบัญชีผู้รับถูกต้อง</strong>.
              ระบบจะเติมเงินอัตโนมัติเฉพาะเมื่อ SlipOK ยืนยันสำเร็จเท่านั้น
              หากยังไม่ตั้งค่า ลูกค้าอัปโหลดสลิปได้ แต่แอดมินต้องตรวจกับ statement เอง
            </p>
            <p className="mt-2 text-[10px] text-muted">
              สมัคร/ดูเอกสาร:{" "}
              <a href="https://slipok.com/api/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                slipok.com/api <ExternalLink className="size-3" />
              </a>{" "}
              — ต้องมี Branch ID และ API Key จาก SlipOK
            </p>

            <div className="mt-4">
              <AdminActionForm action={saveSlipSettingsAction} submitLabel="บันทึกการตรวจสลิป">
                <label className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/50 p-3 text-[11px] font-medium text-fg-soft">
                  <input type="checkbox" name="slipEnabled" defaultChecked={slipConfig.enabled} className="accent-[var(--primary)]" />
                  เปิดตรวจสลิปอัตโนมัติผ่าน SlipOK
                </label>
                <div className="mt-3">
                  <label className="mb-1 block text-[11px] font-semibold text-fg-soft">SlipOK Branch ID</label>
                  <Input name="branchId" defaultValue={slipConfig.branchId} placeholder="Branch ID จาก SlipOK" />
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-[11px] font-semibold text-fg-soft">
                    API Key {slipConfig.hasApiKey ? <span className="text-success">(ตั้งค่าแล้ว — ปล่อยว่างเพื่อคงเดิม)</span> : null}
                  </label>
                  <Input name="apiKey" type="password" autoComplete="new-password" placeholder={slipConfig.hasApiKey ? "•••••••• (ไม่แสดงคีย์)" : "วาง API Key ที่นี่"} />
                  <p className="mt-1 text-[10px] text-muted">เข้ารหัส AES-256-GCM ก่อนบันทึก และไม่แสดงกลับมาที่หน้าเว็บ</p>
                </div>
                <label className="mt-3 flex items-start gap-2 text-[11px] text-fg-soft">
                  <input type="checkbox" name="autoApprove" defaultChecked={slipConfig.autoApprove} className="mt-0.5 accent-[var(--primary)]" />
                  <span>เติมเงินอัตโนมัติเมื่อ SlipOK ยืนยันสำเร็จ (ยอดตรง + บัญชีผู้รับถูกต้อง + สลิปไม่ซ้ำ)</span>
                </label>
              </AdminActionForm>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold">ตัวอย่าง QR ทดสอบ ฿1.00</h3>
            {testQr ? (
              <>
                <div className="mx-auto mt-3 w-full max-w-[240px] rounded-2xl border border-border bg-white p-3">
                  <img src={testQr} alt="PromptPay test QR for 1 baht" className="w-full" />
                </div>
                <p className="mt-2 text-center text-[10px] text-muted">
                  QR นี้ใช้ PromptPay ID จริงของคุณ ยอด ฿1.00 · รหัสอ้างอิงทดสอบ
                </p>
              </>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-border p-6 text-center">
                <QrCode className="mx-auto size-6 text-muted" />
                <p className="mt-2 text-xs text-muted">
                  {qrError ?? "ใส่ PromptPay ID แล้วบันทึก จากนั้น QR ตัวอย่างจะแสดงที่นี่"}
                </p>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="size-4 text-warning" /> วิธีทดสอบการเติมเงินจริง
            </h3>
            <ol className="mt-2 space-y-2 text-[11px] leading-relaxed text-muted">
              <li><strong className="text-fg">1.</strong> ใส่ PromptPay ID ของคุณ แล้วตั้งขั้นต่ำ 1 บาท</li>
              <li><strong className="text-fg">2.</strong> เพิ่ม SlipOK Branch ID + API Key แล้วเปิดใช้งาน</li>
              <li><strong className="text-fg">3.</strong> เข้าด้วยบัญชีลูกค้า → กระเป๋าเงิน → เติม 1 บาท</li>
              <li><strong className="text-fg">4.</strong> สแกน QR ด้วยแอปธนาคาร โอนจริง 1 บาท</li>
              <li><strong className="text-fg">5.</strong> อัปโหลดสลิป — ระบบจะส่งให้ SlipOK ตรวจและเติมเงินอัตโนมัติ</li>
              <li><strong className="text-fg">6.</strong> ตรวจยอดใน Wallet และ Ledger</li>
            </ol>
            <p className="mt-3 text-[10px] text-muted">
              หากไม่ตั้ง SlipOK ระบบจะไม่เติมเงินอัตโนมัติ เพื่อป้องกันสลิปปลอม — แอดมินต้องกดอนุมัติหลังตรวจ statement
            </p>
          </Card>

          <Card className="p-5 text-[11px] text-muted">
            <p className="font-semibold text-fg">ทำไมต้องตรวจกับธนาคาร?</p>
            <p className="mt-1 leading-relaxed">
              รูปสลิปอย่างเดียวตรวจความแท้ไม่ได้ 100% เพราะสลิปปลอม/สลิปซ้ำทำได้ง่าย
              การตรวจที่เชื่อถือได้คือให้ผู้ให้บริการอ่าน QR สลิปแล้วสอบถามธนาคาร พร้อมตรวจบัญชีผู้รับและยอดเงิน
              ซึ่งเป็นวิธีที่ร้านค้าไทยใช้กันทั่วไป
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
