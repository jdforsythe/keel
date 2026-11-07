import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { type ApiError, service } from "@keel/services";
import { InspectSearch } from "./InspectSearch.schema.ts";
import { Inspection } from "./Inspection.schema.ts";
import { inspectApi } from "./inspectApi.service.ts";

const reason = (e: ApiError): string =>
  e.code === "api.status"
    ? `answered ${e.data.status}`
    : e.code === "api.decode"
      ? "did not return an inspect document"
      : e.code === "api.timeout"
        ? "timed out"
        : "is unreachable";

/**
 * Fetch the inspect document of `search.url` (default: the origin of the request `url`, the inspector itself) and
 * shape it for the views (values as JSON text; absent `sections` is none). An unreachable target or a bad document is
 * `inspector.unreachable`.
 */
export const loadInspect = loader({ output: Inspection, search: InspectSearch }, async ({ search, url: at }, ctx) => {
  const url = (search.url ?? new URL(at).origin).replace(/\/+$/, "");
  const r = await service({ base: url, schema: inspectApi }).get({}, ctx);
  if (!r.ok) return err({ code: "inspector.unreachable", message: `${url} ${reason(r.error)}`, data: { url } });
  const d = r.value;
  const stores = Object.fromEntries(
    Object.entries(d.stores).map(([id, st]) => [id, { state: JSON.stringify(st.state), log: st.log }]),
  );
  const sections = Object.fromEntries(
    Object.entries(d.sections ?? {}).map(([id, sec]) => [
      id,
      "error" in sec
        ? { doc: sec.doc, text: sec.error, failed: true }
        : { doc: sec.doc, text: JSON.stringify(sec.value), failed: false },
    ]),
  );
  return ok({ url, live: d.live, graph: d.graph, stores, ids: d.ids, a11y: d.a11y, routes: d.routes, sections });
});
