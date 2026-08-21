import { requireSession } from "@/lib/auth";
import { assertSameOrigin, apiError, HttpError } from "@/lib/http";
import { canWrite, isModule } from "@/lib/modules";
import { deleteRecord, updateRecord } from "@/lib/records";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSession();
    const body = await request.json();
    if (!isModule(body.module) || !canWrite(user.role, body.module)) throw new HttpError(403, "Você não pode alterar este módulo.");
    const record = await updateRecord(user, (await params).id, body.module, body.data);
    if (!record) throw new HttpError(404, "Registro não encontrado.");
    return Response.json({ record });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSession();
    const moduleKey = new URL(request.url).searchParams.get("module") || "";
    if (!isModule(moduleKey) || !canWrite(user.role, moduleKey)) throw new HttpError(403, "Você não pode alterar este módulo.");
    if (!(await deleteRecord(user, (await params).id, moduleKey))) throw new HttpError(404, "Registro não encontrado.");
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
