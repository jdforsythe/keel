import { clientStdData } from "@keel/compiler/std/clientStdData";
import { stdBindings } from "@keel/compiler/std/stdBindings";
import type { DocHead } from "@keel/router/internal";
import { cspPolicy } from "../csp/cspPolicy.ts";
import { CSP_PATH } from "./CSP_PATH.ts";
import type { Rendered } from "./Rendered.ts";
import type { Req } from "./Req.ts";
import { diagLine } from "./diagLine.ts";
import { documentHtml } from "./documentHtml.ts";
import { framedApart } from "./framedApart.ts";
import { headHtml } from "./headHtml.ts";
import { moduleOf } from "./moduleOf.ts";
import { nonceOf } from "./nonceOf.ts";
import { policyHeader } from "./policyHeader.ts";
import { snapshotStores } from "./snapshotStores.ts";

/**
 * An HTML document response: the head and `<html lang>` of `head` (k.head: the route's title, else the deployable's
 * name; the prefix param's value, else `en`), the rendered chain plus one `#k-state` with `stores` (snapshots of the stores island levels touched, by id),
 * `islands` (props by component id) and any `extra` entries; `devMessage` shows only in dev. The entry script
 * (`Served.entry`) loads only when an island was rendered; then `std` carries the
 * client-readable part (`clientStdData`: `clientStd` packages, the served deployable's modules) of the `std.json` data
 * `createApp({ std })` bound, which the resume entry binds in the browser (k.module); absent when that part
 * is empty. HEAD has no body. Each document draws a fresh nonce (`nonceOf`) and carries the k.security policy with it,
 * widened by the served deployable's declared origins (k.origins; report-only in dev) less the document's own origin
 * under `frame` (in dev `http://localhost:<port>`, logged once as an E1590 `diag`), and `Reporting-Endpoints`; `cache-control: private, no-store`, since no cache may replay its nonce.
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
    stores: snapshotStores(r, rendered.touched),
    islands: rendered.islands,
    ...extra,
    ...(std === undefined ? {} : { std }),
  };
  const nonce = nonceOf(r.sv.ctx);
  const own = new URL(r.url).origin;
  const origins = framedApart(r.sv.origins, own);
  if (origins !== r.sv.origins && r.sv.mode === "dev" && r.sv.framed?.has(own) === false) {
    r.sv.framed.add(own);
    r.sv.log?.write(
      diagLine(r.sv.log.format, {
        code: "E1590",
        message: `${r.sv.name}: origins.frame: ${own} is the app's own origin`,
      }),
    );
  }
  const html = documentHtml(
    rendered.html,
    state,
    r.sv.mode === "dev" ? devMessage : null,
    entry,
    headHtml(head.title ?? r.sv.name, r.sv.css, r.sv.built?.files.has("/keel-mark.svg") === true),
    head.lang,
    nonce,
  );
  return new Response(r.method === "HEAD" ? null : html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
      [policyHeader(r.sv.mode)]: cspPolicy({ nonce, dev: r.sv.mode === "dev", origins }),
      "reporting-endpoints": `keel-csp="${CSP_PATH}"`,
    },
  });
}
