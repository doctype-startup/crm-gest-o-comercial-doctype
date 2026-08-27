import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DoctypeOS } from "@/components/doctype-os";
import { DocMonitorOverlay } from "@/components/doc-monitor-overlay";
import { CommercialSuite } from "@/components/commercial-suite";
import { RealtimeMonitor } from "@/components/realtime-monitor";
import { MonitorStateBridge } from "@/components/monitor-state-bridge";
import { getAppState } from "@/lib/state";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OSPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  // Sem If-None-Match (não veio de um GET /api/state condicional), getAppState nunca
  // retorna notModified: true — este guard só existe para o TypeScript estreitar a
  // union e liberar o acesso a `body`.
  const result = await getAppState(session);
  if (result.notModified) throw new Error("Estado inesperado: notModified sem If-None-Match.");
  const state = result.body;
  return <><DoctypeOS initialState={state} /><CommercialSuite initialState={state} /><RealtimeMonitor initialRecords={state.records} /><MonitorStateBridge initialAlerts={state.alerts} /><DocMonitorOverlay state={state} /></>;
}
