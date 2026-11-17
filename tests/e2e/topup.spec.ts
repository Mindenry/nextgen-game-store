import { test, expect, CUSTOMER, ADMIN, login } from "./helpers";

test.describe.serial("Game top-up fulfilment", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{ name: "ngs_lang", value: "en", url: "http://localhost:3000" }]);
  });

  test("customer submits a top-up and staff completes it", async ({ browser }) => {
    const playerId = `9${String(Date.now()).slice(-8)}`;

    const customerContext = await browser.newContext();
    await customerContext.addCookies([{ name: "ngs_lang", value: "en", url: "http://localhost:3000" }]);
    const customerPage = await customerContext.newPage();
    await login(customerPage, CUSTOMER);
    await customerPage.goto("/topup/free-fire");
    await expect(customerPage.getByRole("heading", { level: 1 })).toContainText("Free Fire");

    await customerPage.locator('input[name="field_player_id"]').fill(playerId);
    await customerPage.getByRole("button", { name: /100 Diamonds/i }).click();
    await customerPage.locator('input[name="agree"]').check();
    await customerPage.getByRole("button", { name: /Confirm top-up/i }).click();
    await customerPage.waitForURL(/\/checkout\/success\/NGS-/, { timeout: 30_000 });
    await expect(customerPage.getByText(/Payment confirmed/i).first()).toBeVisible();
    const orderNumber = new URL(customerPage.url()).pathname.split("/").pop();
    await customerContext.close();

    const adminContext = await browser.newContext();
    await adminContext.addCookies([{ name: "ngs_lang", value: "en", url: "http://localhost:3000" }]);
    const adminPage = await adminContext.newPage();
    await login(adminPage, ADMIN);
    await adminPage.goto("/admin/topup");
    const row = adminPage.locator("tr").filter({ hasText: playerId }).first();
    await expect(row).toBeVisible();
    await row.getByText("Update", { exact: true }).click();
    await row.locator('select[name="status"]').selectOption("COMPLETED");
    await row.locator('input[name="note"]').fill("Top-up delivered (E2E)");
    await row.getByRole("button", { name: "Save", exact: true }).click();
    await expect(adminPage.locator("tr").filter({ hasText: playerId }).first().getByText(/completed/i)).toBeVisible();
    await adminContext.close();

    const verifyContext = await browser.newContext();
    await verifyContext.addCookies([{ name: "ngs_lang", value: "en", url: "http://localhost:3000" }]);
    const verifyPage = await verifyContext.newPage();
    await login(verifyPage, CUSTOMER);
    await verifyPage.goto("/dashboard/products");
    await expect(verifyPage.getByText("Free Fire — 100 Diamonds").first()).toBeVisible();
    await expect(verifyPage.getByText(/completed/i).first()).toBeVisible();
    await verifyPage.goto(`/dashboard/orders/${orderNumber}`);
    await expect(verifyPage.getByText(/completed/i).first()).toBeVisible();
    await verifyContext.close();
  });

  test("invalid player ID is rejected before an order is created", async ({ page }) => {
    await login(page, CUSTOMER);
    await page.goto("/topup/free-fire");
    await page.locator('input[name="field_player_id"]').fill("abc");
    await page.getByRole("button", { name: /Confirm top-up/i }).click();
    // Native constraint validation blocks submission; no order/redirect occurs.
    await expect(page).toHaveURL(/\/topup\/free-fire/);
    const invalid = await page.locator('input[name="field_player_id"]').evaluate((element) => {
      const input = element as HTMLInputElement;
      return !input.validity.valid;
    });
    expect(invalid).toBe(true);
  });
});
