"use client";

import { useActionState } from "react";
import { Gift, Loader2 } from "lucide-react";
import { submitTruemoneyVoucherAction, type TruemoneyState } from "@/actions/truemoney";
import { Alert, Button, Input } from "@/components/ui";

export function TruemoneyVoucherForm({
  reference,
  phone,
}: {
  reference: string;
  phone: string;
}) {
  const [state, action, pending] = useActionState<TruemoneyState, FormData>(
    submitTruemoneyVoucherAction,
    {},
  );
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="reference" value={reference} />
      <Alert variant="info">
        {phone ? (
          <>
            ส่งซองอั่งเปา TrueMoney มาที่เบอร์ <strong className="font-mono">{phone}</strong>{" "}
            แล้ววางลิงก์ซองด้านล่าง เจ้าหน้าที่จะเปิดซองและอนุมัติยอดให้
          </>
        ) : (
          <>
            ร้านยังไม่ได้ตั้งเบอร์รับซองอั่งเปาในระบบ — สอบถามเจ้าหน้าที่ผ่านช่องทางติดต่อก่อนสร้างรายการ
            หรือเลือกช่องทาง PromptPay แทน
          </>
        )}
        {" "}ระบบจะไม่เติมเงินอัตโนมัติจากลิงก์
      </Alert>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}
      <Input
        name="voucher"
        required
        placeholder="https://gift.truemoney.com/campaign/?v=..."
        autoComplete="off"
      />
      <Button type="submit" variant="secondary" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
        {pending ? "กำลังส่ง…" : "ส่งลิงก์ซองอั่งเปา"}
      </Button>
      <p className="text-[10px] leading-relaxed text-muted">
        ต้องเป็นลิงก์จาก gift.truemoney.com เท่านั้น · 1 ซองใช้ได้ครั้งเดียว ·
        แอดมินต้อง redeem ก่อนเติมเงินเสมอ
      </p>
    </form>
  );
}
