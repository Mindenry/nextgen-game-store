import { test, expect, CUSTOMER, ADMIN, login } from "./helpers";

test.describe.serial("TrueMoney Angpao manual redemption", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{ name: "ngs_lang", value: "en", url: "http://localhost:3000" }]);
  });

  test("customer submits a voucher and staff approves after redemption", async ({ browser }) => {
    const voucherCode = `E2E${Date.now().toString(36).toUpperCase()}`;
    const voucherUrl = `https://gift.truemoney.com/campaign/?v=${voucherCode}`;

    const customerContext = await browser.newContext();
    await customerContext.addCookies([{ name: "ngs_lang", value: "en", url: "http://localhost:3000" }]);
    const customerPage = await customerContext.newPage();
    await login(customerPage, CUSTOMER);
    await customerPage.goto("/dashboard/wallet/topup");
    await customerPage.locator('input[name="amount"]').fill("1");
    await customerPage.locator('select[name="providerId"]').selectOption("truemoney_angpao");
    await customerPage.getByRole("button", { name: /Create payment/i }).click();
    await customerPage.waitForURL(/\/pay\/NG/, { timeout: 30_000 });
    const reference = new URL(customerPage.url()).pathname.split("/").pop()!;

    await expect(customerPage.getByText("TrueMoney Angpao", { exact: true }).first()).toBeVisible();
    await customerPage.locator('input[name="voucher"]').fill(voucherUrl);
    await customerPage.getByRole("button", { name: /ส่งลิงก์ซองอั่งเปา/ }).click();
    await expect(customerPage.getByText(/ได้รับลิงก์ซองอั่งเปาแล้ว/)).toBeVisible();

    const adminContext = await browser.newContext();
    await adminContext.addCookies([{ name: "ngs_lang", value: "en", url: "http://localhost:3000" }]);
    const adminPage = await adminContext.newPage();
    await login(adminPage, ADMIN);
    await adminPage.goto("/admin/payments?status=MANUAL_REVIEW");
    const card = adminPage.locator(`[data-payment-reference="${reference}"]`).first();
    await expect(card).toBeVisible();
    await expect(card.getByText("TrueMoney Angpao voucher")).toBeVisible();
    await expect(card.getByText(voucherCode)).toHaveCount(0); // code is inside the encrypted link, not plaintext
    await card.locator('input[name="note"]').first().fill("Redeemed in TrueMoney app (E2E)");
    await card.getByRole("button", { name: "Approve", exact: true }).click();
    await adminPage.waitForTimeout(1500);

    await customerPage.goto("/dashboard/wallet/history");
    await expect(customerPage.getByText(reference).first()).toBeVisible();
    await customerContext.close();
    await adminContext.close();
  });
});
