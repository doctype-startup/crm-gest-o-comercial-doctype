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

test("Guardião renders the official mascot artwork in the floating button and drawer", async ({ page }) => {
  await login(page);

  const fabImage = page.locator(".doc-mascot-button-image img");
  await expect(fabImage).toBeVisible();
  await expect(fabImage).toHaveAttribute("src", /^data:image\/webp;base64,/);
  await expect.poll(async () => fabImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBeTruthy();

  const box = await fabImage.boundingBox();
  expect(box?.width).toBeGreaterThan(50);
  expect(box?.height).toBeGreaterThan(50);

  await page.locator(".doc-fab").click();
  const drawer = page.locator(".doc-drawer.open");
  await expect(drawer).toBeVisible();
  await expect(drawer.locator(".doc-mascot-crop-drawer img")).toHaveAttribute("src", /guardiao-(alerta|suporte)\.webp/);
  await expect(drawer.locator(".doc-mascot-crop-tip img")).toHaveAttribute("src", /guardiao-(alerta|suporte)\.webp/);
});

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

test("time-derived alert changes reconcile menu, native card and Guardião without a record update", async ({ page }, testInfo) => {
  await login(page);

  const currentResponse = await page.request.get("/api/state");
  expect(currentResponse.ok()).toBeTruthy();
  const current = await currentResponse.json();
  const syntheticAlert = {
    id: `time-derived-${testInfo.project.name}`,
    severity: "warning",
    title: "Alerta derivado do tempo",
    detail: "Mudança de atenção sem alterar id ou updatedAt do registro",
    module: "tasks",
  };
  const next = {
    ...current,
    alerts: [...current.alerts, syntheticAlert],
    generatedAt: new Date().toISOString(),
  };

  await page.route("**/api/state", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(next) });
  });

  await page.evaluate((payload) => {
    window.dispatchEvent(new CustomEvent("doctype:monitor-state", { detail: payload }));
  }, next);

  const expected = String(next.alerts.length);
  const monitorNav = page.locator(".sidebar nav button").filter({ hasText: "DOC Monitor" });
  await expect(monitorNav.locator(".nav-count")).toHaveText(expected);
  await expect.poll(() => badgeCount(page)).toBe(next.alerts.length);

  await page.locator(".doc-fab").click();
  const drawer = page.locator(".doc-drawer.open");
  await expect(drawer.getByText(`${expected} pontos pedindo atenção`, { exact: true })).toBeVisible();
  await drawer.getByRole("button", { name: "Fechar DOC Monitor" }).click();

  await openNav(page, testInfo, "DOC Monitor");
  await expect(page.locator(".doc-card h2")).toContainText(`${expected} pontos pedem atenção`);
});
