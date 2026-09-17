import { expect, test } from "@playwright/test";

test("mostra acessos da equipe em tempo real no DOC Monitor", async ({ page }, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("admin@doctype.local");
  await page.getByLabel("Senha").fill("Doctype@2026");
  await page.getByRole("button", { name: "Entrar no DOCTYPE OS" }).click();
  await expect(page.getByRole("heading", { name: "Visão Geral" })).toBeVisible();
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "DOC Monitor", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Acessos da equipe" })).toBeVisible();
  await expect(page.getByText("Sessão ativa")).toBeVisible();
  await page.screenshot({ path: `test-results/qa-doc-monitor-access-${testInfo.project.name}.png`, fullPage: true });
});
