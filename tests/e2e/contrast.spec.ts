import { expect, test, type Page, type TestInfo } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("admin@doctype.local");
  await page.getByLabel("Senha").fill("Doctype@2026");
  await page.getByRole("button", { name: "Entrar no DOCTYPE OS" }).click();
  await expect(page.getByRole("heading", { name: "Visão Geral" })).toBeVisible();
}

async function openNav(page: Page, testInfo: TestInfo, label: string) {
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Abrir menu" }).click();
  }
  await page.getByRole("button", { name: label, exact: true }).click();
}

test("dashboard table text stays visible on dark workspace", async ({ page }) => {
  await login(page);

  const cells = page.locator(".dashboard-grid .table-wrap tbody td");
  const count = await cells.count();
  for (let i = 0; i < count; i += 1) {
    const cell = cells.nth(i);
    if (!(await cell.isVisible())) continue;
    const style = await cell.evaluate((element) => {
      const computed = getComputedStyle(element);
      return { color: computed.color, background: computed.backgroundColor, opacity: computed.opacity };
    });
    expect(style.opacity).toBe("1");
    expect(style.color).not.toBe("rgb(23, 32, 51)");
  }
});

test("renewal cards and status text keep explicit contrast", async ({ page }, testInfo) => {
  await login(page);
  await openNav(page, testInfo, "Renovações");

  const card = page.locator(".renewal-card").first();
  if (await card.isVisible()) {
    const titleColor = await card.locator("h3").evaluate((element) => getComputedStyle(element).color);
    const detailColor = await card.locator("p").evaluate((element) => getComputedStyle(element).color);
    expect(titleColor).toBe("rgb(255, 255, 255)");
    expect(detailColor).not.toBe("rgb(23, 32, 51)");
  }
});
