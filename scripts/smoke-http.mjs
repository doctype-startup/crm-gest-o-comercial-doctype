const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3011";
const email = process.env.SEED_ADMIN_EMAIL || "smoke@doctype.local";
const password = process.env.SEED_ADMIN_PASSWORD || "DoctypeSmoke@2026";

function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

const loginPage = await fetch(`${base}/login`);
check(loginPage.ok && (await loginPage.text()).includes("DOCTYPE OS"), "página de login renderiza");

const unauthorized = await fetch(`${base}/api/state`);
check(unauthorized.status === 401, "API rejeita acesso sem sessão");

const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ email, password }) });
check(login.ok, "autenticação válida cria sessão");
const cookie = login.headers.get("set-cookie")?.split(";")[0];
check(Boolean(cookie), "cookie de sessão HTTP-only emitido");

const headers = { "Content-Type": "application/json", Origin: base, Cookie: cookie };
const createdResponse = await fetch(`${base}/api/records`, { method: "POST", headers, body: JSON.stringify({ module: "clients", data: { name: "Cliente HTTP", services: "CRM", monthly: 900, dueDay: 10, status: "Ativo" } }) });
const createdBody = await createdResponse.json();
check(createdResponse.status === 201 && createdBody.record?.id, "CRUD cria cliente persistente");
const id = createdBody.record.id;

const stateResponse = await fetch(`${base}/api/state`, { headers: { Cookie: cookie } });
const state = await stateResponse.json();
check(state.records.some((record) => record.id === id), "novo cliente persiste em outra requisição");

const updatedResponse = await fetch(`${base}/api/records/${id}`, { method: "PUT", headers, body: JSON.stringify({ module: "clients", data: { ...createdBody.record.data, name: "Cliente HTTP Atualizado" } }) });
const updated = await updatedResponse.json();
check(updatedResponse.ok && updated.record.data.name === "Cliente HTTP Atualizado", "CRUD edita cliente");

const backup = await fetch(`${base}/api/backup`, { headers: { Cookie: cookie } });
check(backup.ok && (await backup.json()).records.length > 0, "backup exporta dados compartilhados");

const removed = await fetch(`${base}/api/records/${id}?module=clients`, { method: "DELETE", headers });
check(removed.ok, "CRUD exclui cliente");

const health = await fetch(`${base}/api/health`);
check(health.ok && (await health.json()).status === "healthy", "health check valida banco");

const logout = await fetch(`${base}/api/auth/logout`, { method: "POST", headers });
check(logout.ok, "logout encerra sessão");
