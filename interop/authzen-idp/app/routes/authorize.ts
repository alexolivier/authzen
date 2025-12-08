import { data } from "react-router";
import { callPdp } from "~/lib/pdpClient";
import { getActivePdp } from "~/lib/pdpState";
import type { Route } from "./+types/authorize";

export async function action({ params, request }: Route.ActionArgs) {
  const pdpPath = buildPdpPath(params["*"]);

  const payload = await readJsonBody(request);
  if (payload === undefined) {
    console.error("Missing or invalid request body");
    return data({ error: "Missing or invalid request body" }, { status: 400 });
  }

  try {
    const pdpResponse = await callPdp({
      endpoint: pdpPath,
      payload,
      pdpId: getActivePdp(),
    });

    return pdpResponse;
  } catch (error) {
    console.error("Error calling PDP:", error);
    return data({ error: "Failed to communicate with PDP" }, { status: 500 });
  }
}

async function readJsonBody(request: Request): Promise<unknown | undefined> {
  try {
    const body = await request.json();
    return body ?? undefined;
  } catch {
    return undefined;
  }
}

function buildPdpPath(capture: string | undefined): string {
  const suffix = capture ?? "";
  return `/access/${suffix}`;
}
