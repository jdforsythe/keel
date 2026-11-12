import { clientStdData } from "@keel/compiler/std/clientStdData";
import { stdBindings } from "@keel/compiler/std/stdBindings";
import type { DocHead } from "@keel/router/internal";
import type { Rendered } from "./Rendered.ts";
import type { Req } from "./Req.ts";
import { documentHtml } from "./documentHtml.ts";
import { headHtml } from "./headHtml.ts";
import { moduleOf } from "./moduleOf.ts";
import { snapshotStores } from "./snapshotStores.ts";

/**
 * An HTML document response: the head and `<html lang>` of `head` (k.head: the route's title, else the deployable's
 * name; the prefix param's value, else `en`), the rendered chain plus one `#k-state` with `stores` (snapshots by store id),
 * `islands` (props by component id) and any `extra` entries; `devMessage` shows only in dev. The entry script
 * (`Served.entry`) loads only when an island was rendered; then `std` carries the
 * client-readable part (`clientStdData`: `clientStd` packages, the served deployable's modules) of the `std.json` data
 * `createApp({ std })` bound, which the resume entry binds in the browser (k.module, rfc:0069); absent when that part
 * is empty. HEAD has no body.
 */
export function documentResponse(
  r: Req,
  status: number,
  rendered: Rendered,
  extra: Readonly<Record<string, unknown>>,
  devMessage: string | null,
  head: DocHead = { title: null, lang: "en" },
): Response {
  const entry = Object.keys(rendered.islands).length > 0 ? r.sv.entry : null;
  const bound = entry === null ? undefined : stdBindings.get(r.sv.ctx);
  const sent = bound === undefined ? {} : clientStdData(bound, new Set(r.sv.table.map((x) => moduleOf(x.id))));
  const std = Object.keys(sent).length > 0 ? sent : undefined;
  const state = {
    stores: snapshotStores(r),
    islands: rendered.islands,
    ...extra,
    ...(std === undefined ? {} : { std }),
  };
  const html = documentHtml(
    rendered.html,
    state,
    r.sv.mode === "dev" ? devMessage : null,
    entry,
    headHtml(head.title ?? r.sv.name, r.sv.built),
    head.lang,
  );
  return new Response(r.method === "HEAD" ? null : html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
