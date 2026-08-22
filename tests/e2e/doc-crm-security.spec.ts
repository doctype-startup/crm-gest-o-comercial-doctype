import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page, projectName: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("admin@doctype.local");
  await page.getByLabel("Senha").fill("Doctype@2026");
  await page.getByRole("button", { name: "Entrar no DOCTYPE OS" }).click();
  await expect(page.getByRole("heading", { name: "Visão Geral", level: 1 })).toBeVisible();
  if (projectName === "mobile") await page.getByRole("button", { name: "Abrir menu" }).click();
}

test("DOC CRM keeps readable goal card and table contrast", async ({ page }, testInfo) => {
  await login(page, testInfo.project.name);
  await page.getByRole("button", { name: "DOC CRM", exact: true }).click();
  await expect(page.getByRole("heading", { name: "DOC CRM", exact: true, level: 1 })).toBeVisible();

  const goalCard = page.locator(".goal-card");
  await expect(goalCard).toBeVisible();
  const goalText = goalCard.locator("span").first();
  const goalValue = goalCard.locator("strong").first();
  const goalTextColor = await goalText.evaluate((el) => getComputedStyle(el).color);
  const goalValueColor = await goalValue.evaluate((el) => getComputedStyle(el).color);
  expect(goalTextColor).not.toBe("rgb(23, 32, 51)");
  expect(goalValueColor).toBe("rgb(255, 255, 255)");

  const cells = page.locator(".table-wrap tbody td");
  if (await cells.count()) {
    const cellColor = await cells.first().evaluate((el) => getComputedStyle(el).color);
    expect(cellColor).not.toBe("rgb(23, 32, 51)");
  }
});

test("provisional password banner uses explicit readable contrast when present", async ({ page }, testInfo) => {
  await login(page, testInfo.project.name);
  const banner = page.locator(".security-banner");
  if (!(await banner.isVisible())) return;

  const title = banner.locator("strong");
  const description = banner.locator("span");
  const button = banner.getByRole("button");
  expect(await title.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 255, 255)");
  expect(await description.evaluate((el) => getComputedStyle(el).color)).not.toBe("rgb(23, 32, 51)");
  expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(testInfo.project.name === "mobile" ? 44 : 38);
});
