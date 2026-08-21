import { requireSession } from "@/lib/auth";
import { assertSameOrigin, apiError, HttpError } from "@/lib/http";
import { canRead, canWrite, isModule } from "@/lib/modules";
import { createRecord, listRecords } from "@/lib/records";

export async function GET(request: Request) {
  try {
    const user = await requireSession();
    const moduleKey = new URL(request.url).searchParams.get("module") || "";
    if (!isModule(moduleKey) || !canRead(user.role, moduleKey)) throw new HttpError(403, "Você não tem acesso a este módulo.");
    return Response.json({ records: await listRecords(user.orgId, moduleKey) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSession();
    const body = await request.json();
    if (!isModule(body.module) || !canWrite(user.role, body.module)) throw new HttpError(403, "Você não pode alterar este módulo.");
    return Response.json({ record: await createRecord(user, body.module, body.data) }, { status: 201 });
  } catch (error) { return apiError(error); }
}
