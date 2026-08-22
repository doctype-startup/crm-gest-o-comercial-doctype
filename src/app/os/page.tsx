import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DoctypeOS } from "@/components/doctype-os";
import { DocMonitorOverlay } from "@/components/doc-monitor-overlay";
import { GuardiaoCardRuntime } from "@/components/guardiao-card-runtime";
import { getAppState } from "@/lib/state";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OSPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const state = await getAppState(session);
  return <><DoctypeOS initialState={state} /><GuardiaoCardRuntime /><DocMonitorOverlay state={state} /></>;
}
