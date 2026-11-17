import { test, expect, ADMIN, login } from "./helpers";

const PAGES: { path: string; heading: string }[] = [
  { path: "/admin", heading: /Good to see you/i },
  { path: "/admin/analytics", heading: /Sales analytics/i },
  { path: "/admin/orders", heading: /^Orders$/i },
  { path: "/admin/products", heading: /^Products$/i },
  { path: "/admin/products/new", heading: /Create product/i },
  { path: "/admin/categories", heading: /^Categories$/i },
  { path: "/admin/topup", heading: /Game top-up/i },
  { path: "/admin/inventory", heading: /^Inventory$/i },
  { path: "/admin/wallet", heading: /^Wallets$/i },
  { path: "/admin/payments", heading: /^Payments$/i },
  { path: "/admin/payment-providers", heading: /Payment providers/i },
  { path: "/admin/payment-settings", heading: /Payment settings/i },
  { path: "/admin/customers", heading: /^Customers$/i },
  { path: "/admin/coupons", heading: /^Coupons$/i },
  { path: "/admin/promotions", heading: /^Promotions$/i },
  { path: "/admin/banners", heading: /Banner management/i },
  { path: "/admin/reviews", heading: /^Reviews$/i },
  { path: "/admin/support", heading: /Support tickets/i },
  { path: "/admin/notifications", heading: /^Notifications$/i },
  { path: "/admin/staff", heading: /Staff management/i },
  { path: "/admin/roles", heading: /Roles & permissions/i },
  { path: "/admin/audit", heading: /Audit logs/i },
  { path: "/admin/settings", heading: /Store settings/i },
];

test.describe.serial("Admin dashboard", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{ name: "ngs_lang", value: "en", url: "http://localhost:3000" }]);
  });

  test("every admin module renders without an error boundary", async ({ page }) => {
    await login(page, ADMIN);
    for (const item of PAGES) {
      await page.goto(item.path);
      await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(item.heading);
      await expect(page.getByText("Something went wrong")).toHaveCount(0);
      await expect(page.getByText("Access denied")).toHaveCount(0);
    }
  });

  test("admin order detail opens from the orders list", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/orders");
    const firstOrder = page.locator("table tbody tr").first();
    await expect(firstOrder).toBeVisible();
    await firstOrder.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/admin\/orders\/[0-9a-f-]+/);
    await expect(page.getByText("Items & fulfilment")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Payments", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Audit trail", exact: true })).toBeVisible();
  });
});
