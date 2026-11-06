import type { Rendered } from "./Rendered.ts";
import type { Req } from "./Req.ts";
import { documentHtml } from "./documentHtml.ts";
import { snapshotStores } from "./snapshotStores.ts";

/**
 * An HTML document response: the rendered chain plus one `#k-state` with `stores` (snapshots by store id),
 * `islands` (props by component id) and any `extra` entries; `devMessage` shows only in dev. HEAD has no body.
 */
export function documentResponse(
  r: Req,
  status: number,
  rendered: Rendered,
  extra: Readonly<Record<string, unknown>>,
  devMessage: string | null,
): Response {
  const state = { stores: snapshotStores(r), islands: rendered.islands, ...extra };
  const html = documentHtml(rendered.html, state, r.sv.mode === "dev" ? devMessage : null);
  return new Response(r.method === "HEAD" ? null : html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
