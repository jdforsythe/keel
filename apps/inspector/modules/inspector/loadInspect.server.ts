import type { Ctx } from "@keel/ctx";
import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { type ApiError, service } from "@keel/services";
import { Inspection } from "./Inspection.schema.ts";
import { inspectApi } from "./inspectApi.service.ts";

type Search = { readonly url?: string | undefined };

const reason = (e: ApiError): string =>
  e.code === "api.status"
    ? `answered ${e.data.status}`
    : e.code === "api.decode"
      ? "did not return an inspect document"
      : e.code === "api.timeout"
        ? "timed out"
        : "is unreachable";

/**
 * Fetch the inspect document of `search.url` (default: this page's origin, the inspector itself) and shape it for
 * the views. An unreachable target or a bad document is `inspector.unreachable`.
 */
export const loadInspect = loader(Inspection, async ({ search }: { readonly search: Search }, ctx: Ctx) => {
  const url = (search.url ?? location.origin).replace(/\/+$/, "");
  const r = await service({ base: url, schema: inspectApi }).get({}, ctx);
  if (!r.ok) return err({ code: "inspector.unreachable", message: `${url} ${reason(r.error)}`, data: { url } });
  const d = r.value;
  const stores = Object.fromEntries(
    Object.entries(d.stores).map(([id, st]) => [id, { state: JSON.stringify(st.state), log: st.log }]),
  );
  return ok({ url, live: d.live, graph: d.graph, stores, ids: d.ids, a11y: d.a11y, routes: d.routes });
});
