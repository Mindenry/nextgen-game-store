import { test, expect, ADMIN, login } from "./helpers";
import QRCode from "qrcode";

const CUSTOMER = { email: "player1@nextgen.local", password: "Player1234!" };
const GOLDEN_SLIP = "004000060000010103002021900021231231212000115102TH91049C30";

function crc16(input: string): string {
  let value = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 0x8000 ? ((value << 1) ^ 0x1021) & 0xffff : (value << 1) & 0xffff;
    }
  }
  return value.toString(16).toUpperCase().padStart(4, "0");
}

async function uniqueSlipPng(): Promise<Buffer> {
  const base = GOLDEN_SLIP.slice(0, -4);
  const stamp = String(Date.now()).slice(-6);
  const body = base.replace("0002123123121200011", `0002123123121${stamp}`.slice(0, 19));
  const payload = body + crc16(body);
  const dataUrl = await QRCode.toDataURL(payload, { width: 420, margin: 2 });
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

function statement(rows: string[]): string {
  return [
    "วันที่,เวลา,รายละเอียด,จำนวนเงิน,เลขที่รายการ",
    ...rows,
  ].join("\n");
}

/** Bangkok-local date and time as separate CSV columns (14:32 style). */
function nowInBangkok(): { date: string; time: string } {
  const local = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const iso = local.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 19) };
}

test.describe.serial("bank statement reconciliation", () => {
  test("an incoming bank credit verifies and credits the payment exactly once", async ({ browser }) => {
    const customerContext = await browser.newContext();
    await customerContext.addCookies([{ name: "ngs_lang", value: "en", url: "http://localhost:3000" }]);
    const customer = await customerContext.newPage();
    await login(customer, CUSTOMER);

    // Create a distinctive pending deposit.
    await customer.goto("/dashboard/wallet/topup");
    await customer.locator('input[name="amount"]').fill("7.77");
    await customer.getByRole("button", { name: /Create payment/i }).click();
    await customer.waitForURL(/\/pay\/NG/, { timeout: 30_000 });
    const reference = new URL(customer.url()).pathname.split("/").pop()!;

    const adminContext = await browser.newContext();
    await adminContext.addCookies([{ name: "ngs_lang", value: "en", url: "http://localhost:3000" }]);
    const admin = await adminContext.newPage();
    await login(admin, ADMIN);
    await admin.goto("/admin/bank-reconciliation");
    await expect(admin.getByRole("heading", { name: "Bank reconciliation" })).toBeVisible();

    const csv = statement([
      `${nowInBangkok().date},${nowInBangkok().time},"รับโอนเงิน ${reference} นาย ลูกค้าทดสอบ",7.77,TXN-E2E-${Date.now()}`,
    ]);
    await admin.locator('input[name="statement"]').setInputFiles({
      name: "kbank-statement.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf8"),
    });
    await admin.getByRole("button", { name: "Import & match" }).click();
    await expect(admin.getByText(/Statement imported:.*verified and credited/)).toBeVisible({ timeout: 30_000 });

    // The payment must now be paid, credited exactly once.
    await customer.goto(`/pay/${reference}`);
    await expect(customer.getByText("Payment verified")).toBeVisible({ timeout: 20_000 });

    const status = await customer.request.get(`/api/payments/${reference}/status`);
    expect((await status.json()).status).toBe("PAID");

    // Re-importing the same statement must not credit twice.
    await admin.goto("/admin/bank-reconciliation");
    await admin.locator('input[name="statement"]').setInputFiles({
      name: "kbank-statement.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf8"),
    });
    await admin.getByRole("button", { name: "Import & match" }).click();
    await expect(admin.getByText(/already imported/)).toBeVisible({ timeout: 30_000 });

    await adminContext.close();
    await customerContext.close();
  });

  test("an amount with several open payments is left for manual matching", async ({ browser }) => {
    const customerContext = await browser.newContext();
    await customerContext.addCookies([{ name: "ngs_lang", value: "en", url: "http://localhost:3000" }]);
    const customer = await customerContext.newPage();
    await login(customer, CUSTOMER);

    const references: string[] = [];
    for (const _ of [1, 2]) {
      await customer.goto("/dashboard/wallet/topup");
      await customer.locator('input[name="amount"]').fill("5.55");
      await customer.getByRole("button", { name: /Create payment/i }).click();
      await customer.waitForURL(/\/pay\/NG/, { timeout: 30_000 });
      references.push(new URL(customer.url()).pathname.split("/").pop()!);
    }

    const adminContext = await browser.newContext();
    await adminContext.addCookies([{ name: "ngs_lang", value: "en", url: "http://localhost:3000" }]);
    const admin = await adminContext.newPage();
    await login(admin, ADMIN);
    await admin.goto("/admin/bank-reconciliation");

    const ambiguousRef = `TXN-AMB-${Date.now()}`;
    const csv = statement([
      `${nowInBangkok().date},${nowInBangkok().time},"รับโอนเงิน ไม่มีเลขอ้างอิง",5.55,${ambiguousRef}`,
    ]);
    await admin.locator('input[name="statement"]').setInputFiles({
      name: "ambiguous.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf8"),
    });
    await admin.getByRole("button", { name: "Import & match" }).click();
    await expect(admin.getByText(/Statement imported:/)).toBeVisible({ timeout: 30_000 });

    // Both same-amount payments are still open; the system must not guess.
    const stillPending = await admin.request.get(`/api/payments/${references[0]}/status`);
    expect((await stillPending.json()).status).not.toBe("PAID");

    const card = admin.locator(`[data-bank-ref="ref:${ambiguousRef}"]`);
    await expect(card).toBeVisible({ timeout: 20_000 });
    expect(await card.locator('select[name="paymentId"] option').count()).toBeGreaterThanOrEqual(2);

    // A human picks the correct payment and confirms.
    const targetValue = await card.locator("option", { hasText: references[1] }).getAttribute("value");
    expect(targetValue).toBeTruthy();
    await card.locator('select[name="paymentId"]').selectOption(targetValue!);
    await card.getByRole("button", { name: "ยืนยันรายการนี้" }).click();
    await expect(
      admin.getByText("Payment verified against the bank credit and credited to the customer's wallet."),
    ).toBeVisible({ timeout: 30_000 });

    const paid = await admin.request.get(`/api/payments/${references[1]}/status`);
    expect((await paid.json()).status).toBe("PAID");

    await adminContext.close();
    await customerContext.close();
  });

  test("a slip alone never credits; the statement import does", async ({ browser }) => {
    const customerContext = await browser.newContext();
    await customerContext.addCookies([{ name: "ngs_lang", value: "en", url: "http://localhost:3000" }]);
    const customer = await customerContext.newPage();
    await login(customer, CUSTOMER);

    await customer.goto("/dashboard/wallet/topup");
    await customer.locator('input[name="amount"]').fill("2.22");
    await customer.getByRole("button", { name: /Create payment/i }).click();
    await customer.waitForURL(/\/pay\/NG/, { timeout: 30_000 });
    const reference = new URL(customer.url()).pathname.split("/").pop()!;

    // Upload a structurally valid slip that is NOT backed by any bank credit.
    await customer.locator('input[name="slip"]').setInputFiles({
      name: "slip.png",
      mimeType: "image/png",
      buffer: await uniqueSlipPng(),
    });
    await customer.getByRole("button", { name: /Submit slip for review/i }).click();
    await expect(customer.getByText(/Slip attached/i).first()).toBeVisible({ timeout: 30_000 });

    const afterSlip = await customer.request.get(`/api/payments/${reference}/status`);
    expect((await afterSlip.json()).status).not.toBe("PAID");

    // Only when the merchant imports a real incoming credit does it get paid.
    const adminContext = await browser.newContext();
    await adminContext.addCookies([{ name: "ngs_lang", value: "en", url: "http://localhost:3000" }]);
    const admin = await adminContext.newPage();
    await login(admin, ADMIN);
    await admin.goto("/admin/bank-reconciliation");
    const csv = statement([
      `${nowInBangkok().date},${nowInBangkok().time},"รับโอนเงิน ลูกค้าโอนมา",2.22,TXN-SLIP-${Date.now()}`,
    ]);
    await admin.locator('input[name="statement"]').setInputFiles({
      name: "statement.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf8"),
    });
    await admin.getByRole("button", { name: "Import & match" }).click();
    await expect(admin.getByText(/Statement imported:.*verified and credited/)).toBeVisible({ timeout: 30_000 });

    const paid = await customer.request.get(`/api/payments/${reference}/status`);
    expect((await paid.json()).status).toBe("PAID");

    await adminContext.close();
    await customerContext.close();
  });
});
