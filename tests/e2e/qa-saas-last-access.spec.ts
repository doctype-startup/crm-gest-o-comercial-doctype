import { expect, test } from "@playwright/test";

test("mostra último acesso do administrador nos cards do Admin SaaS Mestre", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("admin@doctype.local");
  await page.getByLabel("Senha").fill("Doctype@2026");
  await page.getByRole("button", { name: "Entrar no DOCTYPE OS" }).click();
  await expect(page.getByRole("heading", { name: "Visão Geral" })).toBeVisible();
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Admin SaaS", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Admin SaaS Mestre" })).toBeVisible();

  await page.locator(".saas-hero").getByRole("button", { name: "Nova empresa" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome da empresa *").fill(`QA Acesso ${suffix}`);
  await dialog.getByLabel("Identificador *").fill(`qa-acesso-${suffix}`.toLowerCase());
  await dialog.getByLabel("Plano *").selectOption("Smart");
  await dialog.getByLabel("Status *").selectOption("Ativo");
  await dialog.getByLabel("Limite de usuários *").fill("5");
  await dialog.getByLabel("Nome do administrador *").fill("Admin QA Acesso");
  await dialog.getByLabel("E-mail do administrador *").fill(`qa-acesso-${suffix}@doctype.local`);
  await dialog.getByLabel("Senha provisória *").fill("Qa@Teste2026");
  await dialog.getByRole("button", { name: "Criar empresa e acesso" }).click();
  await dialog.getByRole("button", { name: "Concluir" }).click();
  await expect(page.getByText("Empresa SaaS criada.")).toBeVisible();

  const card = page.locator(".saas-card").filter({ hasText: `QA Acesso ${suffix}` });
  await expect(card.getByText("Último acesso")).toBeVisible();
  await expect(card.getByText("Nunca acessou")).toBeVisible();
  await page.screenshot({ path: `test-results/qa-saas-last-access-${testInfo.project.name}.png`, fullPage: true });
});
