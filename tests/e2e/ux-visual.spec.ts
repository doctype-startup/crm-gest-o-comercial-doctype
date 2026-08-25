import { expect, test, type Page, type TestInfo } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("admin@doctype.local");
  await page.getByLabel("Senha").fill("Doctype@2026");
  await page.getByRole("button", { name: "Entrar no DOCTYPE OS" }).click();
  await expect(page.getByRole("heading", { name: "Visão Geral" })).toBeVisible();
}

async function openNav(page: Page, testInfo: TestInfo, label: string) {
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Abrir menu" }).click();
  const button = page.getByRole("button", { name: label, exact: true });
  await button.scrollIntoViewIfNeeded();
  await button.click();
}

async function fontSize(locator: ReturnType<Page["locator"]>) {
  return locator.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
}

test.describe("auditoria visual UX", () => {
  test("tipografia e controles mantêm escala legível e alinhada", async ({ page }, testInfo) => {
    await login(page);

    const topTitle = page.locator(".topbar h1");
    expect(await fontSize(topTitle)).toBeGreaterThanOrEqual(22);

    const navButton = page.locator(".sidebar nav button").first();
    expect(await fontSize(navButton)).toBeGreaterThanOrEqual(13);
    const navBox = await navButton.boundingBox();
    expect(navBox?.height ?? 0).toBeGreaterThanOrEqual(42);

    await openNav(page, testInfo, "Clientes 360°");
    const primary = page.locator(".clients-hero .primary").first();
    await expect(primary).toBeVisible();
    const primaryBox = await primary.boundingBox();
    expect(primaryBox?.height ?? 0).toBeGreaterThanOrEqual(testInfo.project.name === "mobile" ? 44 : 40);

    await primary.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome do cliente").fill("Cliente UX E2E");
    await dialog.getByLabel("Serviços contratados").fill("Auditoria visual");
    await dialog.getByLabel("Renovação").fill("2026-09-30");
    await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Cliente UX E2E", { exact: true })).toBeVisible();

    await openNav(page, testInfo, "Renovações");
    const card = page.locator(".renewal-card").filter({ hasText: "Cliente UX E2E" });
    await expect(card).toBeVisible();
    expect(await fontSize(card.locator("h3"))).toBeGreaterThanOrEqual(17);
    expect(await fontSize(card.locator("p"))).toBeGreaterThanOrEqual(13);
    expect(await fontSize(card.locator("> span"))).toBeGreaterThanOrEqual(11);

    const edit = card.getByRole("button", { name: "Editar contrato" });
    const editBox = await edit.boundingBox();
    expect(editBox?.height ?? 0).toBeGreaterThanOrEqual(testInfo.project.name === "mobile" ? 44 : 40);
  });
});
