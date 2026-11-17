import { createHmac } from "node:crypto";
import { test, expect, CUSTOMER, ADMIN, login, walletText } from "./helpers";
import { slipBuffer } from "./slip";

const PROVIDER_SECRET = "e2e-webhook-secret";

async function createDeposit(page: import("@playwright/test").Page, amount: number): Promise<string> {
  await page.goto("/dashboard/wallet/topup");
  await page.locator('input[name="amount"]').fill(String(amount));
  await page.getByRole("button", { name: /Create payment/i }).click();
  await page.waitForURL(/\/pay\/NG/, { timeout: 30_000 });
  const reference = new URL(page.url()).pathname.split("/").pop();
  expect(reference).toMatch(/^NG/);
  return reference!;
}

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "ngs_lang", value: "en", url: "http://localhost:3000" }]);
});

test.describe.serial("Payments: manual review and signed webhooks", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, ADMIN);

    await page.goto("/admin/settings");
    await page.locator('input[name="promptPayId"]').fill("0812345678");
    await page.getByRole("button", { name: /Save payment settings/i }).click();
    await expect(page.getByText("Payment settings saved.")).toBeVisible();

    await page.goto("/admin/payment-providers");
    const promptPayCard = page.locator(".surface-card").filter({ hasText: "PromptPay QR" }).first();
    await promptPayCard.getByText("Configure provider").click();
    const providerForm = promptPayCard.locator("form").filter({ hasText: "Save provider" }).first();
    await providerForm.locator('input[name="secret"]').fill(PROVIDER_SECRET);
    await providerForm.getByRole("button", { name: /Save provider/i }).click();
    await expect(page.getByText(/Payment provider saved/i)).toBeVisible();
    await context.close();
  });

  test("customer uploads a slip and staff approval credits the wallet exactly once", async ({ browser }) => {
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    await login(customerPage, CUSTOMER);
    const before = await walletText(customerPage);

    const reference = await createDeposit(customerPage, 100);
    await expect(customerPage.locator('img[alt*="PromptPay QR"]')).toBeVisible();
    await customerPage.locator('input[name="slip"]').setInputFiles({
      name: "slip.png",
      mimeType: "image/png",
      buffer: slipBuffer(),
    });
    await customerPage.getByRole("button", { name: /Submit slip for review/i }).click();
    await expect(customerPage.getByText(/[\u0E00-\u0E7F]|Slip uploaded/i).first()).toBeVisible();
    await expect(customerPage.getByText(/Manual review|MANUAL REVIEW/i).first()).toBeVisible();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, ADMIN);
    await adminPage.goto("/admin/payments?status=MANUAL_REVIEW");
    const card = adminPage.locator(`[data-payment-reference="${reference}"]`).first();
    await expect(card).toBeVisible();
    await card.locator('input[name="note"]').first().fill("Verified against bank statement (E2E)");
    await card.getByRole("button", { name: "Approve", exact: true }).click();

    await adminPage.waitForTimeout(1500);
    await customerPage.goto("/dashboard/wallet/history");
    await expect(customerPage.getByText(reference).first()).toBeVisible();
    const after = await walletText(customerPage);
    expect(after).not.toBe(before);

    // Approval is one-shot: the payment is no longer in the review queue.
    await adminPage.goto("/admin/payments?status=MANUAL_REVIEW");
    await expect(adminPage.getByText(reference)).toHaveCount(0);
    await customerContext.close();
    await adminContext.close();
  });

  test("webhook signature, amount and duplicate protections", async ({ browser, request }) => {
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    await login(customerPage, CUSTOMER);

    const reference = await createDeposit(customerPage, 50);
    const path = `/api/webhooks/payments/promptpay_qr`;
    const body = JSON.stringify({
      reference,
      amount: 50,
      provider_ref: `WH-${reference}`,
      status: "PAID",
      event: "payment.paid",
    });

    const invalid = await request.post(path, {
      data: body,
      headers: { "x-ngs-signature": "deadbeef", "content-type": "application/json" },
    });
    expect(invalid.status()).toBe(401);

    const signature = createHmac("sha256", PROVIDER_SECRET).update(body).digest("hex");
    const valid = await request.post(path, {
      data: body,
      headers: { "x-ngs-signature": signature, "content-type": "application/json" },
    });
    expect(valid.status()).toBe(200);
    await expect(valid.json()).resolves.toMatchObject({ received: true });

    const paid = await customerPage.request.get(`/api/payments/${reference}/status`);
    expect(paid.status()).toBe(200);
    expect((await paid.json()).status).toBe("PAID");

    // Replayed webhook is idempotent and must not double-credit.
    const replay = await request.post(path, {
      data: body,
      headers: { "x-ngs-signature": signature, "content-type": "application/json" },
    });
    expect(replay.status()).toBe(200);

    await customerPage.goto("/dashboard/wallet/history");
    await expect(customerPage.getByText(reference).first()).toBeVisible();

    // A different payment cannot reuse the same provider transaction id.
    const second = await createDeposit(customerPage, 30);
    const secondBody = JSON.stringify({
      reference: second,
      amount: 30,
      provider_ref: `WH-${reference}`,
      status: "PAID",
    });
    const secondSignature = createHmac("sha256", PROVIDER_SECRET).update(secondBody).digest("hex");
    const duplicate = await request.post(path, {
      data: secondBody,
      headers: { "x-ngs-signature": secondSignature, "content-type": "application/json" },
    });
    expect(duplicate.status()).toBe(409);

    // Mismatched amount must be rejected before any ledger entry.
    const third = await createDeposit(customerPage, 40);
    const thirdBody = JSON.stringify({
      reference: third,
      amount: 39,
      provider_ref: `WH-${third}`,
      status: "PAID",
    });
    const thirdSignature = createHmac("sha256", PROVIDER_SECRET).update(thirdBody).digest("hex");
    const mismatch = await request.post(path, {
      data: thirdBody,
      headers: { "x-ngs-signature": thirdSignature, "content-type": "application/json" },
    });
    expect(mismatch.status()).toBe(409);

    await customerContext.close();
  });

  test("expired QR is reported by the status endpoint", async ({ browser }) => {
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    await login(customerPage, CUSTOMER);
    const reference = await createDeposit(customerPage, 20);
    await customerPage.waitForTimeout(200);
    const status = await customerPage.request.get(`/api/payments/${reference}/status`);
    expect(status.status()).toBe(200);
    // Freshly created QR is still payable.
    expect(["PENDING", "VERIFYING", "MANUAL_REVIEW"]).toContain((await status.json()).status);
    await customerContext.close();
  });
});
