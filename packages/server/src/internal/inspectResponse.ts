import { inspect } from "@keel/reactive";
import { stores } from "@keel/store";

const NAMES = ["ids", "a11y", "routes"] as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** `data` of `<dir>/<name>.json`, or `{}` when there is no directory or the file is missing or unreadable. */
async function artifact(dir: string | undefined, name: string): Promise<unknown> {
  if (dir === undefined) return {};
  const fs = await import("node:fs/promises");
  const text = await fs.readFile(`${dir}/${name}.json`, "utf8").catch(() => "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {};
  }
  return isRecord(parsed) && isRecord(parsed.data) ? parsed.data : {};
}

/**
 * `GET /__keel/inspect` of a dev `createApp` (k.cli Inspect, RFC 0017): `{ live: true, graph: inspect(), stores,
 * ids, a11y, routes }`. `stores` holds every live store of the process (`stores()`) as `{ state, log }`; the
 * artifacts are read from `artifacts` per request. `allow` (an origin `inspectAllowed` admitted) is echoed for a
 * cross-origin read.
 */
export async function inspectResponse(artifacts: string | undefined, allow: string | undefined): Promise<Response> {
  const live: Record<string, { state: unknown; log: unknown }> = {};
  for (const [id, st] of stores()) {
    const snap = st.snapshot();
    live[id] = { state: snap.state, log: snap.log };
  }
  const [ids, a11y, routes] = await Promise.all(NAMES.map((n) => artifact(artifacts, n)));
  const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  if (allow !== undefined) {
    headers.set("access-control-allow-origin", allow);
    headers.set("vary", "origin");
  }
  const body = { live: true, graph: inspect(), stores: live, ids, a11y, routes };
  return new Response(JSON.stringify(body), { status: 200, headers });
}
