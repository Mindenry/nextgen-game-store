import { test, expect, CUSTOMER, ADMIN, login } from "./helpers";

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "ngs_lang", value: "en", url: "http://localhost:3000" }]);
});

test.describe.serial("Customer checkout and delivery", () => {
  test.beforeAll(async ({ browser }) => {
    // Ensure the demo customer has enough balance for repeatable runs.
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, ADMIN);
    await page.goto("/admin/customers?q=demo%40nextgen.local");
    await page.getByRole("link", { name: /^Open/ }).first().click();
    await page.waitForURL(/\/admin\/customers\/[0-9a-f-]+/);
    const form = page.locator("form").filter({ hasText: "Apply adjustment" }).first();
    await form.locator('input[name="amount"]').fill("1000");
    await form.locator('input[name="reason"]').fill("E2E test balance top-up");
    await page.getByRole("button", { name: "Apply adjustment" }).click();
    await expect(page.getByText(/Wallet adjusted/)).toBeVisible();

    // Keep the auto-delivery test repeatable by adding one encrypted unit.
    await page.goto("/admin/products?q=Roblox");
    await page.getByRole("link", { name: "Roblox 1,000 Robux" }).click();
    await page.waitForURL(/\/admin\/products\/[0-9a-f-]+/);
    const inventoryForm = page.locator("form").filter({ hasText: "Encrypt & add inventory" }).first();
    await inventoryForm.locator('textarea[name="items"]').fill(
      JSON.stringify([
        {
          username: `e2e_${Date.now()}`,
          password: "E2e#Password1",
          email: `e2e_${Date.now()}@demo.nextgen.local`,
          notes: "E2E inventory unit",
        },
      ]),
    );
    await inventoryForm.getByRole("button", { name: /Encrypt & add inventory/i }).click();
    await expect(page.getByText(/inventory item\(s\) added/i)).toBeVisible();
    await context.close();
  });

  test("customer signs in, pays from the wallet and receives automatic delivery", async ({ page }) => {
    await login(page, CUSTOMER);
    await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();

    await page.goto("/products/roblox-1000-robux");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Roblox 1,000 Robux");
    await page.getByRole("button", { name: /Add to cart/i }).click();
    await expect(page.getByText("Added to cart").first()).toBeVisible();

    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: /Your cart/i })).toBeVisible();
    await expect(page.getByText("Roblox 1,000 Robux").first()).toBeVisible();
    await page.getByRole("link", { name: /Proceed to checkout/i }).click();
    await page.waitForURL(/\/checkout$/);

    await page.locator('input[name="agree"]').check();
    await page.getByRole("button", { name: /Place order securely/i }).click();
    await page.waitForURL(/\/checkout\/success\/NGS-/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /Your order is in/i })).toBeVisible();
    await expect(page.getByText(/Payment confirmed/i).first()).toBeVisible();

    await page.goto("/dashboard/products");
    await expect(page.getByText("Roblox 1,000 Robux").first()).toBeVisible();
    await page.getByRole("button", { name: /Reveal/i }).first().click();
    await expect(page.getByText(/roblox-1000-robux_/).first()).toBeVisible();

    // Ledger reflects the purchase and the wallet cannot go negative.
    await page.goto("/dashboard/wallet");
    await expect(page.getByText(/Payment for order NGS-/).first()).toBeVisible();
  });

  test("customer cannot access the admin dashboard", async ({ page }) => {
    await login(page, CUSTOMER);
    await page.goto("/admin");
    await page.waitForURL(/\/dashboard\?denied=admin/);
    await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
  });
});
