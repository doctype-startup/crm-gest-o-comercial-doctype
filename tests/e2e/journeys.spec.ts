import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("admin@doctype.local");
  await page.getByLabel("Senha").fill("senha-errada");
  await page.getByRole("button", { name: "Entrar no DOCTYPE OS" }).click();
  await expect(page.getByText("E-mail ou senha inválidos.")).toBeVisible();
  await page.reload();
  await page.getByLabel("E-mail").fill("admin@doctype.local");
  await page.getByLabel("Senha").fill("Doctype@2026");
  await page.getByRole("button", { name: "Entrar no DOCTYPE OS" }).click();
  await expect(page.getByRole("heading", { name: "Visão Geral" })).toBeVisible();
}

async function addRecord(page: Page, nav: string, button: RegExp, fields: Record<string, string>) {
  await page.getByRole("button", { name: nav, exact: true }).click();
  await page.getByRole("button", { name: button }).click();
  const dialog = page.getByRole("dialog");
  if (["Acessos", "DOC CRM"].includes(nav)) await dialog.getByLabel("Cliente").selectOption({ index: 1 });
  for (const [label, value] of Object.entries(fields)) await dialog.getByLabel(label, { exact: false }).fill(value);
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Registro criado.")).toBeVisible();
}

test("login, CRUD, persistência e todos os módulos", async ({ page }, testInfo) => {
  await login(page);
  console.log("STEP login");
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Abrir menu" }).click();
  }
  await page.getByRole("button", { name: "Clientes 360°", exact: true }).click();
  await page.getByRole("button", { name: /Novo cliente/ }).click();
  await page.getByLabel("Nome do cliente").fill(`Cliente E2E ${testInfo.project.name}`);
  await page.getByLabel("Serviços contratados").fill("Marketing e CRM");
  await page.getByLabel("Mensalidade").fill("1500");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText(`Cliente E2E ${testInfo.project.name}`)).toBeVisible();

  await page.getByRole("button", { name: "Editar cliente" }).click();
  await page.getByLabel("Nome do cliente").fill(`Cliente Atualizado ${testInfo.project.name}`);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Registro atualizado.")).toBeVisible();
  await page.reload();
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Clientes 360°", exact: true }).click();
  await expect(page.getByText(`Cliente Atualizado ${testInfo.project.name}`)).toBeVisible();
  console.log("STEP client-persisted");

  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Abrir menu" }).click();
  await addRecord(page, "Acessos", /Novo acesso/, { "Plataforma/rede": "Instagram", "Login/e-mail": "social@cliente.com" });
  console.log("STEP accesses");
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Abrir menu" }).click();
  await addRecord(page, "Operação", /Nova tarefa/, { "Tarefa": "Publicar campanha", "Responsável": "DOC HERO" });
  console.log("STEP tasks");
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Abrir menu" }).click();
  await addRecord(page, "DOC CRM", /Nova assinatura/, {});
  console.log("STEP crm");
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Abrir menu" }).click();
  await addRecord(page, "Equipe", /Novo integrante/, { "Nome": "DOC HERO Teste", "Papel": "Operação" });
  console.log("STEP team");

  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Financeiro", exact: true }).click();
  await page.getByRole("button", { name: /Nova fatura/ }).click();
  let dialog = page.getByRole("dialog"); await dialog.getByLabel("Cliente").selectOption({ index: 1 }); await dialog.getByLabel("Descrição").fill("Mensalidade"); await dialog.getByLabel("Valor").fill("1500"); await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.getByRole("button", { name: /Nova despesa/ }).click();
  dialog = page.getByRole("dialog"); await dialog.getByRole("textbox", { name: "Despesa *" }).fill("Ferramenta"); await dialog.getByLabel("Valor").fill("200"); await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Mensalidade")).toBeVisible(); await expect(page.getByText("Ferramenta")).toBeVisible();
  console.log("STEP finance");

  for (const nav of ["Renovações", "DOC Monitor", "Configurações"]) {
    if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Abrir menu" }).click();
    await page.getByRole("button", { name: new RegExp(`^${nav}`) }).click();
    await expect(page.getByRole("heading", { name: nav, exact: true })).toBeVisible();
    console.log(`STEP nav-${nav}`);
  }
  await page.getByRole("button", { name: "Exportar backup JSON" }).click();
  console.log("STEP backup");
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Clientes 360°", exact: true }).click();
  await page.getByRole("button", { name: "Excluir cliente" }).click();
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(page.getByText(`Cliente Atualizado ${testInfo.project.name}`)).not.toBeVisible();
});

test("jornada comercial produto, cliente, orçamento e contrato persiste", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "A jornada comercial completa é coberta no desktop; o shell mobile é coberto pela jornada principal.");
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
  await expect(page.getByText("Cliente Comercial E2E", { exact: true })).toBeVisible();
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
  await expect(page.getByText("ASSINADO", { exact: true })).toBeVisible();
});
