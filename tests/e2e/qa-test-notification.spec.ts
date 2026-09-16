import { expect, test } from "@playwright/test";

test("envia notificação de teste pelo botão em Configurações", async ({ page }, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("admin@doctype.local");
  await page.getByLabel("Senha").fill("Doctype@2026");
  await page.getByRole("button", { name: "Entrar no DOCTYPE OS" }).click();
  await expect(page.getByRole("heading", { name: "Visão Geral" })).toBeVisible();
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Configurações", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Configurações" })).toBeVisible();
  await page.getByRole("button", { name: "Enviar notificação de teste" }).click();
  await expect(page.getByText("Notificação de teste enviada")).toBeVisible();
  await page.screenshot({ path: `test-results/qa-test-notification-${testInfo.project.name}.png`, fullPage: true });
  await page.locator(".notification-bell").click();
  await expect(page.locator(".notification-item").first()).toContainText("Notificação de teste");
  await page.screenshot({ path: `test-results/qa-test-notification-bell-${testInfo.project.name}.png` });
});
