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
  const state = await getAppState(session);
  return <><DoctypeOS initialState={state} /><CommercialSuite initialState={state} /><RealtimeMonitor initialRecords={state.records} /><MonitorStateBridge initialAlerts={state.alerts} /><DocMonitorOverlay state={state} /></>;
}
