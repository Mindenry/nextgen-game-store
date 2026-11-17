import { test, expect } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "ngs_lang", value: "en", url: "http://localhost:3000" }]);
});

test.describe("Public storefront", () => {
  test("homepage renders real catalogue sections and a working search", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /NEXTGEN GAME STORE home/i }).first()).toBeVisible();
    await expect(page.getByText(/Browse by category/i)).toBeVisible();
    await expect(page.getByText(/Featured products/i)).toBeVisible();
    await expect(page.getByText(/How to buy/i)).toBeVisible();

    const search = page.getByRole("search").first();
    await search.getByRole("textbox", { name: /Search products/i }).fill("Elden");
    await expect(page.getByText("Elden Ring Steam Key").first()).toBeVisible();
    await search.getByRole("textbox").press("Enter");
    await page.waitForURL(/\/products\?q=Elden/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Elden");
    await expect(page.getByText("Elden Ring Steam Key").first()).toBeVisible();
  });

  test("product filters, product detail and category pages work", async ({ page }) => {
    await page.goto("/products?category=gift-cards");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Gift Cards");

    await page.goto("/products/elden-ring-steam-key");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Elden Ring Steam Key");
    await expect(page.getByText(/Instant delivery/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Add to cart/i })).toBeVisible();
    await page.goto("/products/steam-wallet-500");
    await expect(page.getByText(/Verified purchase/i).first()).toBeVisible();

    await page.goto("/categories/game-topup");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Game Top-Up");
  });

  test("mobile navigation and responsive layout", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("navigation").filter({ hasText: "Top-up" }).last()).toBeVisible();
    await expect(page.getByRole("button", { name: /Open menu/i })).toBeVisible();
    await page.getByRole("button", { name: /Open menu/i }).click();
    await expect(page.getByRole("link", { name: /Sign in/i }).last()).toBeVisible();
  });

  test("unknown product returns the 404 page", async ({ page }) => {
    await page.goto("/products/does-not-exist-xyz");
    await expect(page.getByText("Page not found")).toBeVisible();
  });

  test("guest is redirected to login for checkout", async ({ page }) => {
    await page.goto("/checkout");
    await page.waitForURL(/\/login\?next=%2Fcheckout/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });
});
