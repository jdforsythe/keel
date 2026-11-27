import { loader } from "@keel/router";
import { attempt, err, ok } from "@keel/schema";
import { service } from "@keel/services";
import { Inspection } from "./Inspection.schema.ts";
import { inspectApi } from "./inspectApi.service.ts";
import { inspector } from "./inspector.contract.ts";

/** The host names of this machine, as `new URL(...).hostname` writes them. */
const LOOPBACK: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The origin `target` names when it is an origin and nothing more: http or https, a loopback host, no user name or
 * password, no path but `/`, no query and no fragment (`?` or `#` alone count). Anything else is undefined.
 */
const originOf = (target: string): string | undefined => {
  const u = attempt(() => new URL(target));
  if (!u.ok) return undefined;
  const { protocol, username, password, hostname, pathname, search, hash } = u.value;
  const bare = !/[?#]/.test(target);
  return (protocol === "http:" || protocol === "https:") &&
    username === "" &&
    password === "" &&
    LOOPBACK.has(hostname) &&
    pathname === "/" &&
    search === "" &&
    hash === "" &&
    bare
    ? u.value.origin
    : undefined;
};

/**
 * Fetch the inspect document of the origin `search.url` names (default: the inspector's own) on the server and shape
 * it for the views (values as JSON text; absent `sections` is none). Since the server fetches what a visitor names:
 * - the page is `local: true` (k.contract Local routes), so the server runs this only for a loopback connection with a
 *   loopback `Host` and `Sec-Fetch-Site` `same-origin` or `none`; any other request is 403 `keel.denied` first;
 * - it takes `?url=` only when that is an origin on this machine (`originOf`), and requests
 *   `<origin>/__keel/inspect` built from the parsed origin alone, so nothing else of the caller's string is sent;
 * - every failure of the fetch (refused, a status, a redirect, a timeout, a body that is no inspect document) is one
 *   answer, `inspector.unreachable` `no inspect document at <origin>`, which says nothing of what listens there.
 * The fetch goes through `ctx.net` and follows no redirect.
 */
export const loadInspect = loader(
  inspector,
  "inspector.index",
  { output: Inspection },
  async ({ search, url: at }, ctx) => {
    const target = search.url ?? new URL(at).origin;
    const origin = originOf(target);
    if (origin === undefined)
      return err({
        code: "inspector.unreachable",
        message: "?url= is not the origin of an app on this machine",
        data: { url: "" },
      });
    const r = await service({ base: origin, schema: inspectApi }).get({}, ctx);
    if (!r.ok)
      return err({ code: "inspector.unreachable", message: `no inspect document at ${origin}`, data: { url: origin } });
    const url = origin;
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
