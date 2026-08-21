import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DoctypeOS } from "@/components/doctype-os";
import { getAppState } from "@/lib/state";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OSPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <DoctypeOS initialState={await getAppState(session)} />;
}
