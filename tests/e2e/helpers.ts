import { test as base, expect, type Page } from "@playwright/test";
import fs from "node:fs";

export const CUSTOMER = { email: "demo@nextgen.local", password: "Demo1234!" };
function envValue(key: string): string {
  try {
    const line = fs
      .readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.startsWith(key + "="));
    return (line?.split("=").slice(1).join("=") ?? "").replace(/^"|"$/g, "");
  } catch {
    return "";
  }
}
export const ADMIN = {
  email: envValue("BOOTSTRAP_ADMIN_EMAIL") || "admin@nextgen.local",
  password: envValue("BOOTSTRAP_ADMIN_PASSWORD"),
};

export async function login(page: Page, account: { email: string; password: string }) {
  await page.goto("/login");
  await page.locator("#email").fill(account.email);
  await page.locator("#password").fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/(dashboard|admin)/, { timeout: 30_000 });
}

export async function walletText(page: Page): Promise<string> {
  await page.goto("/dashboard/wallet");
  const locator = page.locator("p").filter({ hasText: /^฿/ }).first();
  await expect(locator).toBeVisible();
  return (await locator.innerText()).trim();
}

export const test = base;
export { expect };
