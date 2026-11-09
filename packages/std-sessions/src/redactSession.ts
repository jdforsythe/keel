import type { Manifest, RouteDef } from "@keel/router";
import { compileRoutes, compileTable, matchUrl } from "@keel/router/internal";
import { type JsonValue, type Schema, s } from "@keel/schema";
import { stores } from "@keel/store";
import type { Session } from "./Session.schema.ts";
import type { SessionEvent } from "./SessionEvent.ts";
import { hrefOf } from "./internal/hrefOf.ts";
import { jsonOf } from "./internal/jsonOf.ts";
import { objectOf } from "./internal/objectOf.ts";
import { parseRedactEntry } from "./internal/parseRedactEntry.ts";
import { redact } from "./redact.ts";

const json = s.json();

/**
 * `session` with every recorded string written as `x` repeated unless an `expose` entry names its path (std.sessions
 * D3, what `to-test` writes): base `state` (`store:`), base and `nav` params and search (`route:`), `tx` payloads
 * (`tx:`), `fire` input values and one-character keys (`el:<id>#value`), error data (`error:`), and every error
 * `message` (free text, never exposed). `s.id`, `s.enum`
 * and `s.literal` values stay. Schemas come from the live stores and `routes`; without one, every string goes. `id`,
 * `seed`, `at`, `fingerprint` and the route ids stay, so `replay` of the result checks the fingerprint still holds.
 */
export function redactSession<M extends Readonly<Record<string, RouteDef>>>(
  session: Session,
  options: { readonly routes: Manifest<M>; readonly expose: readonly string[] },
): Session {
  const routes: Readonly<Record<string, RouteDef>> = options.routes.routes;
  const exposed = new Map<string, string[]>();
  for (const e of options.expose) {
    const p = parseRedactEntry(e);
    if (p !== undefined)
      exposed.set(`${p.subject}:${p.target}`, [...(exposed.get(`${p.subject}:${p.target}`) ?? []), p.path]);
  }
  const keep = (key: string, prefix = ""): string[] =>
    (exposed.get(key) ?? []).filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length));
  const strings = (schema: Schema<unknown, boolean> | undefined, value: JsonValue, key: string, prefix = "") =>
    redact(schema ?? json, value, {
      paths: [],
      seed: session.seed ?? 0,
      salt: key,
      strings: { except: keep(key, prefix) },
    });
  const live = stores();
  const route = (id: string, params: JsonValue, search: JsonValue) => {
    const def = Object.hasOwn(routes, id) ? routes[id] : undefined;
    return {
      id,
      params: objectOf(strings(def?.params, params, `route:${id}`, "params.")),
      search: objectOf(strings(def?.search, search, `route:${id}`, "search.")),
    };
  };
  const table = compileTable(compileRoutes(routes), routes);
  const error = (e: Session["error"]): Session["error"] =>
    e === null
      ? null
      : { ...e, message: "x".repeat(e.message.length), data: strings(undefined, e.data, `error:${e.code}`, "data.") };

  const event = (e: SessionEvent): SessionEvent => {
    switch (e.kind) {
      case "tx": {
        const schema = live.get(e.store)?.payloads.get(e.name);
        return { ...e, payload: strings(schema, e.payload, `tx:${e.name}`) };
      }
      case "nav": {
        const m = matchUrl(table, e.href);
        if (m.kind !== "route" || m.route.def.path === undefined) return e;
        const def = m.route.def;
        const r = route(m.route.id, jsonOf(m.params, def.params), jsonOf(m.search, def.search));
        return { ...e, href: hrefOf(def.path ?? "", r.params, r.search) };
      }
      case "fire": {
        const shown = keep(`el:${e.id}`).includes("value");
        if (shown) return e;
        if (e.event.type === "input")
          return { ...e, event: { type: "input", value: "x".repeat(e.event.value.length) } };
        if (e.event.type === "keydown" && e.event.key.length === 1)
          return { ...e, event: { type: "keydown", key: "x" } };
        return e;
      }
      case "error":
        return { ...e, error: error(e.error) ?? e.error };
      default:
        return e;
    }
  };

  const state: Record<string, JsonValue> = {};
  for (const [id, v] of Object.entries(session.state)) state[id] = strings(live.get(id)?.schema, v, `store:${id}`);
  return {
    ...session,
    route: route(session.route.id, session.route.params, session.route.search),
    state,
    events: session.events.map(event),
    error: error(session.error),
  };
}
