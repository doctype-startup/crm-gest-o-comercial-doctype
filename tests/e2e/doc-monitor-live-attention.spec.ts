import { expect, test, type Page, type TestInfo } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("admin@doctype.local");
  await page.getByLabel("Senha").fill("Doctype@2026");
  await page.getByRole("button", { name: "Entrar no DOCTYPE OS" }).click();
  await expect(page.locator(".topbar h1")).toHaveText("Visão Geral");
}

async function openNav(page: Page, testInfo: TestInfo, label: string) {
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Abrir menu" }).click();
  const target = label === "DOC Monitor"
    ? page.getByRole("button", { name: /^DOC Monitor/ })
    : page.getByRole("button", { name: label, exact: true });
  await target.scrollIntoViewIfNeeded();
  await target.click();
}

async function badgeCount(page: Page) {
  const badge = page.locator(".doc-fab b");
  return await badge.count() ? Number(await badge.textContent()) : 0;
}

test("attention count, DOC card and responsive Guardião bubble share the live monitor state", async ({ page }, testInfo) => {
  await login(page);
  const before = await badgeCount(page);

  await openNav(page, testInfo, "Operação");
  await page.getByRole("button", { name: /Nova tarefa/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tarefa").fill(`Alerta ao vivo ${testInfo.project.name}`);
  await dialog.getByLabel("Prazo").fill("2026-08-20");
  await dialog.getByLabel("Prioridade").selectOption("Crítica");
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Registro criado.")).toBeVisible();

  await expect.poll(() => badgeCount(page), { timeout: 12000 }).toBe(before + 1);
  const after = before + 1;

  await page.locator(".doc-fab").click();
  const drawer = page.locator(".doc-drawer.open");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(`${after} ponto${after === 1 ? "" : "s"} pedindo atenção`, { exact: true })).toBeVisible();
  await expect(drawer.locator(".doc-speech p")).not.toBeEmpty();
  await expect(drawer.locator(".doc-online")).toContainText(/Online|Sincronizando|Reconectando|Desatualizado/);
  await drawer.getByRole("button", { name: "Fechar DOC Monitor" }).click();

  await openNav(page, testInfo, "DOC Monitor");
  await expect(page.locator(".doc-card h2")).toContainText(`${after} ponto`);
});
