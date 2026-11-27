import { loader } from "@keel/router";
import { defect, err, ok } from "@keel/schema";
import { type ApiError, service } from "@keel/services";
import { Inspection } from "./Inspection.schema.ts";
import { Unreachable } from "./Unreachable.schema.ts";
import { inspectApi } from "./inspectApi.service.ts";
import { inspector } from "./inspector.contract.ts";

/** Why a call to the target failed, as `inspector.unreachable` carries it. */
const why = (e: ApiError): { why: "status" | "decode" | "timeout" | "unreachable"; status?: number } =>
  e.code === "api.status"
    ? { why: "status", status: e.data.status }
    : e.code === "api.decode"
      ? { why: "decode" }
      : e.code === "api.timeout"
        ? { why: "timeout" }
        : { why: "unreachable" };

/**
 * Fetch the inspect document of `search.url` (default: the origin of the request `url`, the inspector itself) and
 * shape it for the views (values as JSON text; absent `sections` is none). An unreachable target or a bad document is
 * `inspector.unreachable`.
 */
export const loadInspect = loader(
  inspector,
  "inspector.index",
  { output: Inspection },
  async ({ search, url: at }, ctx) => {
    const url = (search.url ?? (URL.parse(at) ?? defect("a request has an address")).origin).replace(/\/+$/, "");
    const r = await service({ base: url, schema: inspectApi }).get({}, ctx);
    if (!r.ok) return err(Unreachable.make({ url, ...why(r.error) }));
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
  },
);
