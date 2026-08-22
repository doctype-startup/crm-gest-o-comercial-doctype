import { expect, test, type Page, type TestInfo } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("admin@doctype.local");
  await page.getByLabel("Senha").fill("Doctype@2026");
  await page.getByRole("button", { name: "Entrar no DOCTYPE OS" }).click();
  await expect(page.locator(".topbar h1")).toHaveText("Visão Geral");
}

async function expose(page: Page, testInfo: TestInfo, locator: import("@playwright/test").Locator) {
  if (testInfo.project.name === "mobile") await locator.focus();
  else await locator.hover();
}

async function openNav(page: Page, testInfo: TestInfo, label: string) {
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Abrir menu" }).click();
  const button = page.getByRole("button", { name: label, exact: true });
  await button.scrollIntoViewIfNeeded();
  await button.click();
}

test("interactive hover and focus states preserve readable contrast across DOC.OS", async ({ page }, testInfo) => {
  await login(page);

  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Abrir menu" }).click();
  const clientNav = page.getByRole("button", { name: "Clientes 360°", exact: true });
  await expose(page, testInfo, clientNav);
  expect(await clientNav.locator("span").evaluate((el) => getComputedStyle(el).color)).toBe("rgb(6, 19, 63)");
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Fechar menu" }).click();

  const quick = page.locator(".dashboard-grid .quick").first();
  await expose(page, testInfo, quick);
  expect(await quick.locator("span").evaluate((el) => getComputedStyle(el).color)).toBe("rgb(93, 104, 120)");
  expect(await quick.locator("strong").evaluate((el) => getComputedStyle(el).color)).toBe("rgb(6, 19, 63)");

  await openNav(page, testInfo, "Clientes 360°");
  const rows = page.locator(".table-wrap tbody tr");
  if (await rows.count()) {
    const row = rows.first();
    if (testInfo.project.name === "mobile") {
      const action = row.locator("button").first();
      if (await action.count()) await action.focus();
    } else {
      await row.hover();
    }
    const cell = row.locator("td").first();
    expect(await cell.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 255, 255)");
  }

  await openNav(page, testInfo, "Produtos");
  await expect(page.locator(".commercial-page")).toBeVisible();
  const commercialRows = page.locator(".commercial-table tbody tr").filter({ has: page.locator("td strong") });
  if (await commercialRows.count()) {
    const row = commercialRows.first();
    if (testInfo.project.name === "mobile") {
      const action = row.locator(".commercial-row-actions button").first();
      if (await action.count()) await action.focus();
    } else {
      await row.hover();
    }
    expect(await row.locator("td strong").first().evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 255, 255)");
  }
});
