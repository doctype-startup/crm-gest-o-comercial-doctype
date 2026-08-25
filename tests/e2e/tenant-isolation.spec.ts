import { expect, test, type Page, type TestInfo } from "@playwright/test";

type ApiResult<T> = { status: number; body: T };
type RecordPayload = { id: string; data: { name?: string } };

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar no DOCTYPE OS" }).click();
  await expect(page.locator(".topbar h1")).toHaveText("Visão Geral", { timeout: 15_000 });
}

async function openNav(page: Page, testInfo: TestInfo, label: string) {
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: label, exact: true }).click();
}

async function provisionOrganization(page: Page, input: { name: string; slug: string; email: string; password: string }) {
  await page.locator(".saas-hero").getByRole("button", { name: "Nova empresa" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome da empresa *").fill(input.name);
  await dialog.getByLabel("Identificador *").fill(input.slug);
  await dialog.getByLabel("Plano *").selectOption("Smart");
  await dialog.getByLabel("Status *").selectOption("Ativo");
  await dialog.getByLabel("Limite de usuários *").fill("5");
  await dialog.getByLabel("Nome do administrador *").fill(`Admin ${input.name}`);
  await dialog.getByLabel("E-mail do administrador *").fill(input.email);
  await dialog.getByLabel("Senha provisória *").fill(input.password);
  await dialog.getByRole("button", { name: "Criar empresa e acesso" }).click();
  await expect(page.getByText("Empresa SaaS criada.")).toBeVisible();
  await expect(page.getByRole("heading", { name: input.name, exact: true })).toBeVisible();
}

async function api<T>(page: Page, path: string, method = "GET", body?: unknown): Promise<ApiResult<T>> {
  return page.evaluate(async ({ path: url, method: httpMethod, body: requestBody }) => {
    const response = await fetch(url, {
      method: httpMethod,
      headers: requestBody === undefined ? undefined : { "Content-Type": "application/json" },
      body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
    });
    return { status: response.status, body: await response.json() };
  }, { path, method, body });
}

test("Admin SaaS provisiona empresas com dados totalmente isolados", async ({ browser, page }, testInfo) => {
  const suffix = testInfo.project.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const tenantA = { name: `Agência Aurora ${suffix}`, slug: `agencia-aurora-${suffix}`, email: `aurora-${suffix}@doctype.local`, password: "Aurora@2026!" };
  const tenantB = { name: `Agência Boreal ${suffix}`, slug: `agencia-boreal-${suffix}`, email: `boreal-${suffix}@doctype.local`, password: "Boreal@2026!" };
  const clientA = { name: `Cliente exclusivo Aurora ${suffix}`, services: "CRM Aurora", monthly: 1200, dueDay: 10, status: "Ativo" };
  const clientB = { name: `Cliente exclusivo Boreal ${suffix}`, services: "CRM Boreal", monthly: 1800, dueDay: 15, status: "Ativo" };

  await login(page, "admin@doctype.local", "Doctype@2026");
  await openNav(page, testInfo, "Admin SaaS");
  await expect(page.getByRole("heading", { name: "Admin SaaS Mestre" })).toBeVisible();
  await provisionOrganization(page, tenantA);
  await provisionOrganization(page, tenantB);

  const viewport = testInfo.project.name === "mobile" ? { width: 390, height: 844 } : { width: 1280, height: 720 };
  const contextA = await browser.newContext({ baseURL: "http://127.0.0.1:3010", viewport });
  const contextB = await browser.newContext({ baseURL: "http://127.0.0.1:3010", viewport });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await login(pageA, tenantA.email, tenantA.password);
    await login(pageB, tenantB.email, tenantB.password);

    const createdA = await api<{ record: RecordPayload }>(pageA, "/api/records", "POST", { module: "clients", data: clientA });
    const createdB = await api<{ record: RecordPayload }>(pageB, "/api/records", "POST", { module: "clients", data: clientB });
    expect(createdA.status).toBe(201);
    expect(createdB.status).toBe(201);

    const listA = await api<{ records: RecordPayload[] }>(pageA, "/api/records?module=clients");
    const listB = await api<{ records: RecordPayload[] }>(pageB, "/api/records?module=clients");
    expect(listA.body.records.map((record) => record.data.name)).toEqual([clientA.name]);
    expect(listB.body.records.map((record) => record.data.name)).toEqual([clientB.name]);

    const usersA = await api<{ users: Array<{ email: string }> }>(pageA, "/api/users");
    const usersB = await api<{ users: Array<{ email: string }> }>(pageB, "/api/users");
    expect(usersA.body.users.map((user) => user.email)).toEqual([tenantA.email]);
    expect(usersB.body.users.map((user) => user.email)).toEqual([tenantB.email]);

    const updateAFromB = await api(pageB, `/api/records/${createdA.body.record.id}`, "PUT", { module: "clients", data: { ...clientA, name: "INVASÃO BLOQUEADA" } });
    const deleteAFromB = await api(pageB, `/api/records/${createdA.body.record.id}?module=clients`, "DELETE");
    const updateBFromA = await api(pageA, `/api/records/${createdB.body.record.id}`, "PUT", { module: "clients", data: { ...clientB, name: "INVASÃO BLOQUEADA" } });
    const deleteBFromA = await api(pageA, `/api/records/${createdB.body.record.id}?module=clients`, "DELETE");
    expect([updateAFromB.status, deleteAFromB.status, updateBFromA.status, deleteBFromA.status]).toEqual([404, 404, 404, 404]);

    const afterAttackA = await api<{ records: RecordPayload[] }>(pageA, "/api/records?module=clients");
    const afterAttackB = await api<{ records: RecordPayload[] }>(pageB, "/api/records?module=clients");
    expect(afterAttackA.body.records.map((record) => record.data.name)).toEqual([clientA.name]);
    expect(afterAttackB.body.records.map((record) => record.data.name)).toEqual([clientB.name]);

    await pageA.reload();
    await pageB.reload();
    await openNav(pageA, testInfo, "Clientes 360°");
    await openNav(pageB, testInfo, "Clientes 360°");
    await expect(pageA.getByText(clientA.name, { exact: true })).toBeVisible();
    await expect(pageA.getByText(clientB.name, { exact: true })).toHaveCount(0);
    await expect(pageB.getByText(clientB.name, { exact: true })).toBeVisible();
    await expect(pageB.getByText(clientA.name, { exact: true })).toHaveCount(0);
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
