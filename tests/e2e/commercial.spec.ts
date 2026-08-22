import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("admin@doctype.local");
  await page.getByLabel("Senha").fill("Doctype@2026");
  await page.getByRole("button", { name: "Entrar no DOCTYPE OS" }).click();
  await expect(page.getByRole("heading", { name: "Visão Geral" })).toBeVisible();
}

test.describe("gestão comercial", () => {
  test.skip(({ isMobile }) => isMobile, "A jornada comercial completa roda em desktop; o shell mobile é validado em journeys.spec.ts.");

  test("produto, cliente, orçamento e contrato persistem", async ({ page }) => {
    await login(page);

    await page.getByRole("button", { name: "Produtos", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Produtos", exact: true })).toBeVisible();
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

    await page.getByRole("button", { name: "Fechar", exact: true }).click();
    await page.getByRole("button", { name: "Clientes 360°", exact: true }).click();
    await page.getByRole("button", { name: /Novo cliente/ }).click();
    const clientDialog = page.getByRole("dialog");
    await clientDialog.getByLabel("Nome do cliente").fill("Cliente Comercial E2E");
    await clientDialog.getByLabel("Serviços contratados").fill("DOC CRM");
    await clientDialog.getByRole("button", { name: /DOC CRM E2E/ }).click();
    await clientDialog.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Cliente Comercial E2E", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Orçamentos", exact: true }).click();
    await page.getByRole("button", { name: "Orçamento", exact: true }).click();
    modal = page.locator(".commercial-modal");
    await modal.getByLabel("Cliente *").selectOption({ label: "Cliente Comercial E2E" });
    await modal.getByLabel("Título do orçamento *").fill("Implantação DOC CRM E2E");
    await modal.getByRole("button", { name: /DOC CRM E2E/ }).click();
    await modal.getByLabel("Desconto (R$)").fill("90");
    await modal.getByLabel("Status").selectOption("Aprovado");
    await modal.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("R$ 1.400,00", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Contratos", exact: true }).click();
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
    await expect(page.getByText("R$ 1.400,00", { exact: true })).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "Produtos", exact: true }).click();
    await expect(page.getByText("DOC CRM E2E", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Contratos", exact: true }).click();
    await expect(page.getByText("Cliente Comercial E2E", { exact: true })).toBeVisible();
    await expect(page.getByText("Assinado", { exact: true })).toBeVisible();
  });
});
