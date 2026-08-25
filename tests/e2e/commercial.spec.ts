import { expect, test, type Page, type TestInfo } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("admin@doctype.local");
  await page.getByLabel("Senha").fill("Doctype@2026");
  await page.getByRole("button", { name: "Entrar no DOCTYPE OS" }).click();
  await expect(page.locator(".topbar h1")).toHaveText("Visão Geral", { timeout: 15_000 });
}

async function openNav(page: Page, testInfo: TestInfo, label: string) {
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Abrir menu" }).click();
  }
  const target = page.getByRole("button", { name: label, exact: true });
  await target.scrollIntoViewIfNeeded();
  await target.click();
}

async function expectCommercialShell(page: Page, label: "Produtos" | "Orçamentos" | "Contratos") {
  await expect(page.locator(".topbar h1")).toHaveText(label);
  await expect(page.locator(".sidebar nav button.active")).toHaveCount(1);
  await expect(page.getByRole("button", { name: label, exact: true })).toHaveClass(/active/);
  await expect(page.locator(".commercial-page")).toBeVisible();
  await expect(page.locator(".commercial-page")).toHaveCSS("color", "rgb(247, 249, 255)");
  await expect(page.locator(".commercial-head h1")).toHaveText(label);
}

async function expectCommercialTableValue(page: Page, value: string) {
  await expect(page.locator(".commercial-table tbody td").filter({ hasText: value }).first()).toBeVisible();
}

test.describe("gestão comercial", () => {
  test("produto, cliente, orçamento e contrato persistem com shell DOC.OS sincronizado", async ({ page }, testInfo) => {
    await login(page);

    await openNav(page, testInfo, "Produtos");
    await expectCommercialShell(page, "Produtos");
    await page.getByRole("button", { name: "Produto", exact: true }).click();
    let modal = page.locator(".commercial-modal");
    await modal.getByLabel("Nome do produto *").fill("DOC CRM E2E");
    await modal.getByLabel("SKU / Código").fill("CRM-E2E");
    await modal.getByLabel("Categoria").fill("CRM");
    await modal.getByLabel("Preço de venda").fill("1490");
    await modal.getByLabel("Custo").fill("390");
    await modal.getByLabel("Cobrança").selectOption("Mensal");
    await modal.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("DOC CRM E2E", { exact: true })).toBeVisible();
    await expectCommercialShell(page, "Produtos");

    await page.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(page.locator(".commercial-page")).toHaveCount(0);
    await openNav(page, testInfo, "Clientes 360°");
    await expect(page.locator(".topbar h1")).toHaveText("Clientes 360°");
    await page.locator(".clients-hero").getByRole("button", { name: /Novo cliente/ }).click();
    const clientDialog = page.getByRole("dialog");
    await clientDialog.getByLabel("Nome do cliente").fill("Cliente Comercial E2E");
    await clientDialog.getByLabel("Serviços contratados").fill("DOC CRM");
    await clientDialog.getByRole("button", { name: /DOC CRM E2E/ }).click();
    await clientDialog.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Cliente Comercial E2E", { exact: true })).toBeVisible();

    await openNav(page, testInfo, "Orçamentos");
    await expectCommercialShell(page, "Orçamentos");
    await page.getByRole("button", { name: "Orçamento", exact: true }).click();
    modal = page.locator(".commercial-modal");
    await modal.getByLabel("Cliente *").selectOption({ label: "Cliente Comercial E2E" });
    await modal.getByLabel("Título do orçamento *").fill("Implantação DOC CRM E2E");
    await modal.getByRole("button", { name: /DOC CRM E2E/ }).click();
    await modal.getByLabel("Desconto (R$)").fill("90");
    await modal.getByLabel("Status").selectOption("Aprovado");
    await modal.getByRole("button", { name: "Salvar", exact: true }).click();
    await expectCommercialTableValue(page, "R$ 1.400,00");
    await expectCommercialShell(page, "Orçamentos");

    await openNav(page, testInfo, "Contratos");
    await expectCommercialShell(page, "Contratos");
    await page.getByRole("button", { name: "Contrato", exact: true }).click();
    modal = page.locator(".commercial-modal");
    await modal.getByLabel("Cliente *").selectOption({ label: "Cliente Comercial E2E" });
    await modal.getByLabel("Orçamento relacionado").selectOption({ index: 1 });
    await modal.getByLabel("Título do contrato *").fill("Contrato DOC CRM E2E");
    await modal.getByRole("button", { name: /DOC CRM E2E/ }).click();
    await modal.getByLabel("Valor do contrato").fill("1400");
    await modal.getByLabel("Data da assinatura").fill("2026-08-21");
    await modal.getByLabel("Status").selectOption("Assinado");
    await modal.getByRole("button", { name: "Salvar", exact: true }).click();
    await expectCommercialTableValue(page, "R$ 1.400,00");
    await expectCommercialShell(page, "Contratos");

    await page.reload();
    await openNav(page, testInfo, "Produtos");
    await expectCommercialShell(page, "Produtos");
    await expect(page.getByText("DOC CRM E2E", { exact: true })).toBeVisible();
    await openNav(page, testInfo, "Contratos");
    await expectCommercialShell(page, "Contratos");
    await expect(page.getByText("Cliente Comercial E2E", { exact: true })).toBeVisible();
    await expect(page.getByText("Assinado", { exact: true })).toBeVisible();
  });

  test("DOC Monitor usa o Guardião válido", async ({ page }, testInfo) => {
    await login(page);
    const asset = await page.request.get("/assets/guardiao-monitor.webp");
    expect(asset.ok()).toBeTruthy();
    expect(asset.headers()["content-type"]).toContain("image/webp");
    await openNav(page, testInfo, "DOC Monitor");
    const card = page.locator(".doc-card.large");
    await expect(card).toBeVisible();
    const image = await card.evaluate((element) => getComputedStyle(element, "::after").backgroundImage);
    expect(image).toContain("guardiao-monitor.webp");
  });
});
