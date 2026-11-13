import type { Action } from "../types/Action.ts";
import type { RouteActions } from "../types/RouteActions.ts";
import type { Table } from "./Table.ts";
import { codedError } from "./codedError.ts";
import { routeActions } from "./routeActions.ts";
import { sealed } from "./sealed.ts";

const VERBS = ["POST", "PUT", "PATCH", "DELETE"];

/** An own data property (a getter or a Proxy trap never runs), else `undefined`. */
const own = (o: object, k: string): unknown => Object.getOwnPropertyDescriptor(o, k)?.value;
const fn = (v: unknown): boolean => typeof v === "function";

/** The first field of the `action(...)` shape (what `runAction` reads) that is missing or wrong, else `null`. */
function badField(v: unknown): string | null {
  if (typeof v !== "object" || v === null || own(v, "kind") !== "keel.action") return "kind";
  if (!fn(own(v, "run"))) return "run";
  const input = own(v, "input");
  if (typeof input !== "object" || input === null) return "input";
  if (!fn(own(input, "parse")) || !fn(own(input, "decodeStrings")) || own(input, "node") === undefined)
    return "input.parse";
  const stores = own(v, "stores");
  return stores !== undefined && !fn(stores) ? "stores" : null;
}

/**
 * Attach actions to routes of one compiled table (`routes.actions`). Throws an Error with `code`: E1505 an
 * id that is not a route with a `path` here, a key that is not POST/PUT/PATCH/DELETE, a value lacking a field of the `action(...)` shape (`undefined` hints an import cycle), a route that already has
 * actions, or one a router or server already compiled (`sealed`: attach in `routes.ts`, before `createApp`); E1507
 * an action declaring a `params` schema that is not the route's own value.
 */
export function attachActions(table: Table, byId: Readonly<Record<string, RouteActions | undefined>>): void {
  for (const [id, acts] of Object.entries(byId)) {
    const r = table.get(id);
    if (r === undefined || r.segments === null) throw codedError("E1505", `${id}: not a route with a path`);
    if (routeActions.has(r.def)) throw codedError("E1505", `${id}: actions already attached`);
    if (sealed.has(r.def)) throw codedError("E1505", `${id}: actions attached after createApp or createRouter`);
    for (const [verb, act] of Object.entries(acts ?? {})) {
      if (!VERBS.includes(verb)) throw codedError("E1505", `${id}: actions key "${verb}" is not POST/PUT/PATCH/DELETE`);
      const bad = badField(act);
      if (bad !== null)
        throw codedError(
          "E1505",
          `${id}: ${verb} action lacks ${bad}${act === undefined ? " (import routes.ts first)" : ""}`,
        );
      if (act !== undefined && own(act, "params") !== undefined && own(act, "params") !== r.def.params)
        throw codedError("E1507", `${id}: ${verb} action params schema is not this route's params`);
    }
  }
  for (const [id, acts] of Object.entries(byId)) {
    const r = table.get(id);
    // An empty value attaches nothing, so a route with entries in `routeActions` has at least one action.
    if (r !== undefined && acts !== undefined && Object.keys(acts).length > 0)
      routeActions.set(r.def, Object.freeze({ ...acts }));
  }
}
