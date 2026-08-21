import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { audit, db } from "@/lib/db";
import { assertSameOrigin, apiError, HttpError } from "@/lib/http";
import { isModule, moduleSchemas } from "@/lib/modules";

const backupSchema = z.object({
  version: z.literal(1),
  records: z.array(z.object({ module: z.string(), data: z.record(z.string(), z.unknown()) })).max(10000),
  settings: z.record(z.string(), z.unknown()).default({}),
});

export async function GET() {
  try {
    const user = await requireSession();
    if (user.role !== "CEO_ADMIN") throw new HttpError(403, "Somente o administrador pode exportar backups.");
    const [records, settings] = await Promise.all([
      db.selectFrom("records").select(["module", "data"]).where("org_id", "=", user.orgId).execute(),
      db.selectFrom("settings").select(["key", "value"]).where("org_id", "=", user.orgId).execute(),
    ]);
    await audit(user.orgId, user.id, "EXPORT", "backup", null);
    return Response.json({ version: 1, generatedAt: new Date().toISOString(), records: records.map((r) => ({ module: r.module, data: JSON.parse(r.data) })), settings: Object.fromEntries(settings.map((s) => [s.key, JSON.parse(s.value)])) }, { headers: { "Content-Disposition": `attachment; filename="DOCTYPE_OS_${new Date().toISOString().slice(0, 10)}.json"` } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSession();
    if (user.role !== "CEO_ADMIN") throw new HttpError(403, "Somente o administrador pode restaurar backups.");
    const backup = backupSchema.parse(await request.json());
    const parsed = backup.records.map((record) => {
      if (!isModule(record.module)) throw new HttpError(400, `Módulo inválido no backup: ${record.module}`);
      return { module: record.module, data: moduleSchemas[record.module].parse(record.data) };
    });
    const now = new Date().toISOString();
    await db.transaction().execute(async (trx) => {
      await trx.deleteFrom("records").where("org_id", "=", user.orgId).execute();
      for (const record of parsed) await trx.insertInto("records").values({ id: randomUUID(), org_id: user.orgId, module: record.module, data: JSON.stringify(record.data), created_by: user.id, created_at: now, updated_at: now }).execute();
      for (const [key, value] of Object.entries(backup.settings)) {
        const exists = await trx.selectFrom("settings").select("key").where("org_id", "=", user.orgId).where("key", "=", key).executeTakeFirst();
        if (exists) await trx.updateTable("settings").set({ value: JSON.stringify(value), updated_at: now }).where("org_id", "=", user.orgId).where("key", "=", key).execute();
        else await trx.insertInto("settings").values({ org_id: user.orgId, key, value: JSON.stringify(value), updated_at: now }).execute();
      }
    });
    await audit(user.orgId, user.id, "RESTORE", "backup", null, { records: parsed.length });
    return Response.json({ ok: true, records: parsed.length });
  } catch (error) { return apiError(error); }
}
