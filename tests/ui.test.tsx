// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DoctypeOS } from "@/components/doctype-os";
import type { AppRecord, SessionUser } from "@/lib/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("next/image", () => ({ default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => { const { priority, ...imageProps } = props; void priority; return React.createElement("img", imageProps); } }));

const user: SessionUser = { id: "u1", orgId: "o1", name: "NAY", email: "nay@doctype.local", role: "CEO_ADMIN", mustChangePassword: false };
const client: AppRecord = { id: "c1", module: "clients", data: { name: "Cliente Existente", services: "Marketing", monthly: 1200, renewal: "2026-09-20", health: "Saudável", status: "Ativo" }, createdAt: "2026-08-20T00:00:00Z", updatedAt: "2026-08-20T00:00:00Z" };
const initialState = { records: [client], alerts: [], settings: { crmGoal: 3000 }, user, generatedAt: "2026-08-20T12:00:00Z" };

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn(async (input) => {
    const url = String(input);
    if (url === "/api/state") return Response.json(initialState);
    if (url === "/api/users") return Response.json({ users: [{ id: "u1", name: "NAY", email: "nay@doctype.local", role: "CEO_ADMIN", active: true, mustChangePassword: false }] });
    return Response.json({ ok: true, record: client });
  }) as typeof fetch;
});
afterEach(() => cleanup());

describe("jornadas visíveis do DOCTYPE OS", () => {
  it("abre todos os módulos do menu sem botão inerte", async () => {
    const actor = userEvent.setup();
    render(<DoctypeOS initialState={initialState} />);
    for (const label of ["Clientes 360°", "Acessos", "Financeiro", "Operação", "Renovações", "DOC CRM", "Equipe", "DOC Monitor", "Configurações", "Visão Geral"]) {
      await actor.click(screen.getByRole("button", { name: label }));
      expect(screen.getAllByRole("heading", { name: label }).length).toBeGreaterThan(0);
    }
  }, 15_000);

  it("cria, edita e exclui cliente pelos controles da interface", async () => {
    const actor = userEvent.setup();
    render(<DoctypeOS initialState={initialState} />);
    await actor.click(screen.getByRole("button", { name: "Clientes 360°" }));
    await actor.click(screen.getByRole("button", { name: /Novo cliente/ }));
    await actor.type(screen.getByLabelText(/Nome do cliente/), "Novo Cliente");
    await actor.type(screen.getByLabelText(/Serviços contratados/), "CRM e IA");
    await actor.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/records", expect.objectContaining({ method: "POST" })));
    expect(await screen.findByText("Registro criado.")).toBeTruthy();

    await actor.click(screen.getByRole("button", { name: "Editar cliente" }));
    await actor.clear(screen.getByLabelText(/Nome do cliente/));
    await actor.type(screen.getByLabelText(/Nome do cliente/), "Cliente Editado");
    await actor.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/records/c1", expect.objectContaining({ method: "PUT" })));

    await actor.click(screen.getByRole("button", { name: "Excluir cliente" }));
    expect(screen.getByText(/acessos, faturas, tarefas, assinaturas, orçamentos e contratos vinculados/)).toBeTruthy();
    await actor.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/records/c1?module=clients", expect.objectContaining({ method: "DELETE" })));
  });
});
