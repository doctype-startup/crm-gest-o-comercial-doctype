import { expect, test } from "@playwright/test";

test("settings save goal button stays aligned with MRR field", async ({ page }, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("admin@doctype.local");
  await page.getByLabel("Senha").fill("Doctype@2026");
  await page.getByRole("button", { name: "Entrar no DOCTYPE OS" }).click();
  await expect(page.locator("h1", { hasText: "Visão Geral" })).toBeVisible();

  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Abrir menu" }).click();
  }
  await page.getByRole("button", { name: "Configurações", exact: true }).click();

  const card = page.locator(".settings-grid > .card").first();
  const field = card.getByLabel("MRR desejado");
  const button = card.getByRole("button", { name: "Salvar meta" });
  await expect(field).toBeVisible();
  await expect(button).toBeVisible();

  const fieldBox = await field.boundingBox();
  const buttonBox = await button.boundingBox();
  expect(fieldBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();
  if (!fieldBox || !buttonBox) return;

  expect(buttonBox.y).toBeGreaterThan(fieldBox.y + fieldBox.height - 1);
  expect(Math.abs(buttonBox.x - fieldBox.x)).toBeLessThanOrEqual(2);
  expect(buttonBox.height).toBeGreaterThanOrEqual(testInfo.project.name === "mobile" ? 44 : 40);

  if (testInfo.project.name === "mobile") {
    expect(Math.abs(buttonBox.width - fieldBox.width)).toBeLessThanOrEqual(3);
  }
});
