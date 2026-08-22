import { expect, test, type Page, type TestInfo } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("admin@doctype.local");
  await page.getByLabel("Senha").fill("Doctype@2026");
  await page.getByRole("button", { name: "Entrar no DOCTYPE OS" }).click();
  await expect(page.locator(".topbar h1")).toHaveText("Visão Geral");
}

async function openMonitor(page: Page, testInfo: TestInfo) {
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: /^DOC Monitor/ }).click();
  await expect(page.locator(".topbar h1")).toHaveText("DOC Monitor");
}

test("DOC Monitor rotates intelligence and refreshes immediately on CRM events", async ({ page }, testInfo) => {
  await login(page);
  await openMonitor(page, testInfo);

  const monitor = page.locator(".realtime-health");
  await expect(monitor).toBeVisible();
  await expect(monitor.getByText("DOC MONITOR AO VIVO")).toBeVisible();
  await expect(monitor.locator(".live-sync")).toContainText(/AO VIVO|SINCRONIZANDO/);
  await expect(monitor.locator(".monitor-rotation-grid .monitor-live-item")).toHaveCount(4);
  await expect(monitor.getByText(/registros na leitura atual/)).toBeVisible();

  const rotation = monitor.locator(".monitor-rotation");
  const firstSection = await rotation.getAttribute("data-section");
  await monitor.getByRole("button", { name: "Próxima informação" }).click();
  await expect.poll(async () => rotation.getAttribute("data-section")).not.toBe(firstSection);

  const stateResponse = page.waitForResponse((response) => response.url().includes("/api/state") && response.request().method() === "GET" && response.ok());
  await page.evaluate(() => window.dispatchEvent(new Event("doctype:records-changed")));
  await stateResponse;
  await expect(monitor.locator(".live-sync")).toContainText("AO VIVO");
});
