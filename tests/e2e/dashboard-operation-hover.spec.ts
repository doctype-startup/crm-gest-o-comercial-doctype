import { expect, test } from "@playwright/test";

test("Visão Geral Operação agora keeps text readable on hover", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("admin@doctype.local");
  await page.getByLabel("Senha").fill("Doctype@2026");
  await page.getByRole("button", { name: "Entrar no DOCTYPE OS" }).click();
  await expect(page.locator("h1")).toHaveText("Visão Geral");

  const operationCard = page.locator(".dashboard-grid > section.card").first();
  await expect(operationCard.getByRole("heading", { name: "Operação agora" })).toBeVisible();

  const quick = operationCard.locator(".quick").first();
  await quick.hover();

  const label = quick.locator("span");
  const value = quick.locator("strong");
  expect(await label.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(93, 104, 120)");
  expect(await value.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(6, 19, 63)");
  expect(await label.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  expect(await value.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
});
