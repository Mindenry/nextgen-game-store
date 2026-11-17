import { test, expect } from "@playwright/test";
import { ADMIN, login } from "./helpers";

test("payment settings and 1 THB product are ready", async ({ page, context }) => {
  await context.addCookies([{ name: "ngs_lang", value: "en", url: "http://localhost:3000" }]);
  await page.goto("/login");
  await login(page, ADMIN);
  await page.goto("/admin/payment-settings");
  await expect(page.getByRole("heading", { name: "Payment settings" })).toBeVisible();
  const min = page.locator('input[name="minDeposit"]').first();
  console.log("MIN DEPOSIT VALUE", await min.inputValue());
  expect(Number(await min.inputValue())).toBe(1);
  await expect(page.getByText(/PromptPay ID \(เบอร์โทร/)).toBeVisible();
  await expect(page.getByText(/ตรวจสลิปอัตโนมัติ \(SlipOK\)/)).toBeVisible();
  await page.screenshot({ path: "test-results/payment-settings.png", fullPage: true });

  await page.goto("/products/test-digital-delivery-1-thb");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("1 THB");
  await expect(page.getByText("฿1.00").first()).toBeVisible();
  await page.screenshot({ path: "test-results/test-product.png", fullPage: true });
});
