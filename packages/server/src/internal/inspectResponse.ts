import { artifactData } from "@keel/compiler/inspect/artifactData";
import { inspectorSections } from "@keel/compiler/inspect/inspectorSections";
import type { Ctx } from "@keel/ctx";
import { inspect } from "@keel/reactive";
import { stores } from "@keel/store";
import type { Diag } from "./Diag.ts";

const NAMES = ["ids", "a11y", "routes"] as const;

/** `data` of `<dir>/<name>.json`, or `{}` when there is no directory or the file is missing or unreadable. */
async function artifact(dir: string | undefined, name: string): Promise<unknown> {
  if (dir === undefined) return {};
  const fs = await import("node:fs/promises");
  const text = await fs.readFile(`${dir}/${name}.json`, "utf8").catch(() => "");
  return artifactData(text);
}

/**
 * `GET /__keel/inspect` of a dev `createApp` (k.cli Inspect): `{ live: true, graph: inspect(), stores,
 * ids, a11y, routes, sections }`. `stores` holds every live store of the process (`stores()`) as `{ state, log }`; the
 * artifacts are read from `artifacts` per request; `sections` are the inspector hooks read with `ctx`, and
 * `diags` their E1057s for the dev log. Called outside any request scope, so `graph` is the app's alone. `allow` (an
 * origin `inspectAllowed` admitted) is echoed for a cross-origin read.
 */
export async function inspectResponse(
  artifacts: string | undefined,
  allow: string | undefined,
  ctx: Ctx,
): Promise<{ response: Response; diags: Diag[] }> {
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
  const { sections, diags } = inspectorSections(ctx);
  const body = { live: true, graph: inspect(), stores: live, ids, a11y, routes, sections };
  return { response: new Response(JSON.stringify(body), { status: 200, headers }), diags };
}
