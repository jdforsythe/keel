import { loader } from "@keel/router";
import { attempt, err, ok } from "@keel/schema";
import { type ApiError, service } from "@keel/services";
import { Inspection } from "./Inspection.schema.ts";
import { inspectApi } from "./inspectApi.service.ts";
import { inspector } from "./inspector.contract.ts";

/** The host names of this machine, as `new URL(...).hostname` writes them. */
const LOOPBACK: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Whether `url` is an http or https URL whose host is this machine: its `hostname` exactly one of `LOOPBACK`, any
 * port, and no user name or password. Any other scheme, host or a URL that does not parse is not.
 */
const onThisMachine = (url: string): boolean => {
  const u = attempt(() => new URL(url));
  return (
    u.ok &&
    (u.value.protocol === "http:" || u.value.protocol === "https:") &&
    u.value.username === "" &&
    u.value.password === "" &&
    LOOPBACK.has(u.value.hostname)
  );
};

const reason = (e: ApiError): string =>
  e.code === "api.status"
    ? `answered ${e.data.status}`
    : e.code === "api.decode"
      ? "did not return an inspect document"
      : e.code === "api.timeout"
        ? "timed out"
        : "is unreachable";

/**
 * Fetch the inspect document of `search.url` (default: the origin of the request `url`, the inspector itself) on the
 * server and shape it for the views (values as JSON text; absent `sections` is none). The target must be on this
 * machine (`onThisMachine`), since the server fetches a URL a visitor gave: any other is `inspector.unreachable`
 * `<url> is not on this machine`, and nothing is fetched. The fetch goes through `ctx.net` and follows no redirect, so
 * a 3xx is `answered <status>`. An unreachable target or a bad document is `inspector.unreachable`.
 */
export const loadInspect = loader(
  inspector,
  "inspector.index",
  { output: Inspection },
  async ({ search, url: at }, ctx) => {
    const url = (search.url ?? new URL(at).origin).replace(/\/+$/, "");
    if (!onThisMachine(url))
      return err({ code: "inspector.unreachable", message: `${url} is not on this machine`, data: { url } });
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
  },
);
