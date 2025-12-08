import { redirect } from "react-router";
import { clearAuditLog } from "~/lib/auditLog";
import type { Route } from "./+types/audit-log";

export async function loader(_: Route.LoaderArgs) {
  clearAuditLog();
  return redirect("/");
}
