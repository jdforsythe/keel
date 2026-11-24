import type { JsonValue } from "@keel/schema";
import type { Session } from "./Session.schema.ts";

/** A `nav` input's route match (by index in `events`). */
type NavCall = {
  readonly index: number;
  readonly id: string;
  readonly params: { readonly [k: string]: JsonValue };
  readonly search: { readonly [k: string]: JsonValue };
};
/** A store to seed: its id, its export name and the import specifier from the test file. */
type StoreImport = { readonly id: string; readonly name: string; readonly from: string };
/**
 * A serving module: its id, the import specifier of its `routes.ts` (`from`) and of its contract file (`contract`,
 * `modules/<id>/<id>.contract.ts`, or '' for a module whose contract it cannot import: its navs are left out) from the test file.
 */
type RoutesImport = { readonly module: string; readonly from: string; readonly contract: string };

/** The `node` form's app: the deployable, and the import specifiers (from the test file) of `topology.ts` and `identity.server.ts`. */
type ServeImport = { readonly deployable: string; readonly topology: string; readonly identity?: string };

const RESERVED = new Set([
  "app",
  "createApp",
  "identity",
  "topology",
  "createCtx",
  "record",
  "renderRoute",
  "expect",
  "test",
  "routeTable",
  "routes",
  "ctx",
  "params",
  "search",
  "rec",
  "h",
]);
const lit = (v: JsonValue): string => JSON.stringify(v);
const empty = (o: { readonly [k: string]: JsonValue }): boolean => Object.keys(o).length === 0;

/** `<contract>.href(id, params?, search?)` with literal arguments, trailing empty objects left out. */
function href(contract: string, n: NavCall): string {
  const args = [lit(n.id)];
  if (!empty(n.params) || !empty(n.search)) args.push(lit(n.params));
  if (!empty(n.search)) args.push(lit(n.search));
  return `${contract}.href(${args.join(", ")})`;
}
const moduleOf = (id: string): string => id.slice(0, Math.max(0, id.indexOf(".")));

/**
 * The `@keel/testing` file `keel session to-test` writes for `session` (std.sessions):
 * header `// Session: <fingerprint>, seed <n>`, then one straight-line test (no loops or helpers) that creates a sim
 * ctx of the session's seed (absent: 0), advances the clock to `at`, records, renders the base route with its params,
 * search and the state of each importable store, applies each input in order (`fire` as `h.fire(id, event)`, `nav` as
 * `h.navigate(<contract>.href(...))` with literal arguments, the contract of the nav's module imported from its contract
 * file, so a changed route schema fails `tsc`), advancing the clock only where `at` changes, and ends
 * `expect(rec.errors()).toEqual([])`. Stores not in `stores` are left out of `state` (they start from their initial
 * value). Several serving modules' route tables are joined with `routeTable`. With `user` the base renders with
 * `user: <id>` in its options. With `serve` (a `node` deployable serves the page) the file builds the app after the
 * clock advance and before `record` (`createApp` over `topology.ts`, the tables and `identity.server.ts`) and passes it
 * as `app` to `renderRoute`, with no `state` and no store import: the app's own storage is the page's state.
 */
export function toTest(
  session: Session,
  options: {
    readonly navs: readonly NavCall[];
    readonly stores: readonly StoreImport[];
    readonly routes: readonly RoutesImport[];
    readonly serve?: ServeImport;
    readonly user?: string;
  },
): string {
  const seed = session.seed ?? 0;
  const imports = [
    'import { createCtx } from "@keel/ctx";',
    ...(options.routes.length > 1 ? ['import { routeTable } from "@keel/router";'] : []),
    ...(options.serve === undefined ? [] : ['import { createApp } from "@keel/server";']),
    'import { record } from "@keel/std-sessions/record";',
    'import { renderRoute } from "@keel/testing";',
    'import { expect, test } from "vitest";',
  ];
  const taken = new Set(RESERVED);
  const local = (want: string, kind = "Store"): string => {
    let name = taken.has(want) ? `${want}${kind}` : want;
    for (let i = 2; taken.has(name); i++) name = `${want}${kind}${i}`;
    taken.add(name);
    return name;
  };
  const seeded: string[] = [];
  for (const st of options.serve === undefined ? options.stores : []) {
    const as = local(st.name);
    imports.push(`import { ${st.name === as ? as : `${st.name} as ${as}`} } from ${lit(st.from)};`);
    const value = session.state[st.id];
    if (value !== undefined) seeded.push(`[${as}, ${lit(value)}]`);
  }
  const [one] = options.routes;
  const join: string[] = [];
  if (options.routes.length === 1 && one !== undefined) imports.push(`import { routes } from ${lit(one.from)};`);
  else {
    const names = options.routes.map((r) => {
      const as = local(`${r.module.replace(/[^A-Za-z0-9_$]/g, "_")}Routes`);
      imports.push(`import { routes as ${as} } from ${lit(r.from)};`);
      return as;
    });
    join.push(`const routes = routeTable(${names.join(", ")});`);
  }
  const contracts = new Map<string, string>();
  for (const n of options.navs) {
    const m = moduleOf(n.id);
    const r = options.routes.find((x) => x.module === m);
    if (r === undefined || r.contract === "" || contracts.has(m)) continue;
    const as = local(m.replace(/[^A-Za-z0-9_$]/g, "_"), "Contract");
    imports.push(`import { ${m === as ? as : `${m} as ${as}`} } from ${lit(r.contract)};`);
    contracts.set(m, as);
  }
  const body: string[] = [`  const ctx = createCtx({ mode: "sim", seed: ${seed} });`];
  let now = 0;
  const advance = (at: number): void => {
    if (at > now) body.push(`  ctx.clock.advance(${at - now});`);
    now = Math.max(now, at);
  };
  // The `node` form always writes the base's advance (the sim clock starts at 0): the app is built after it.
  if (options.serve === undefined) advance(session.at);
  else {
    body.push(`  ctx.clock.advance(${session.at});`);
    now = session.at;
  }
  const { serve } = options;
  if (serve !== undefined) {
    imports.push(`import topology from ${lit(serve.topology)};`);
    if (serve.identity !== undefined) imports.push(`import identity from ${lit(serve.identity)};`);
    body.push(
      `  const app = await createApp({ topology, deployable: ${lit(serve.deployable)}, routes, ctx${serve.identity === undefined ? "" : ", identity"} });`,
    );
  }
  body.push("  const rec = record(ctx);");
  const r = session.route;
  const user = options.user === undefined ? "" : `, user: ${lit(options.user)}`;
  if (serve === undefined)
    body.push(
      `  const h = await renderRoute(${lit(r.id)}, { routes, params: ${lit(r.params)}, search: ${lit(r.search)}, state: [${seeded.join(", ")}], ctx${user} });`,
    );
  else
    body.push(
      `  const params = ${lit(r.params)};`,
      `  const search = ${lit(r.search)};`,
      `  const h = await renderRoute(${lit(r.id)}, { routes, params, search, ctx, app${user} });`,
    );
  const navs = new Map(options.navs.map((n) => [n.index, n]));
  for (const [i, e] of session.events.entries()) {
    if (e.kind === "fire" || e.kind === "net") {
      advance(e.at);
      body.push(
        e.kind === "net" ? `  ctx.net.setOnline(${e.online});` : `  await h.fire(${lit(e.id)}, ${lit(e.event)});`,
      );
    } else if (e.kind === "nav") {
      const n = navs.get(i);
      const contract = n === undefined ? undefined : contracts.get(moduleOf(n.id));
      if (n === undefined || contract === undefined) continue;
      advance(e.at);
      body.push(`  await h.navigate(${href(contract, n)});`);
    }
  }
  body.push("  expect(rec.errors()).toEqual([]);", "  h.dispose();");
  return [
    `// Session: ${session.fingerprint}, seed ${seed}`,
    ...imports,
    "",
    ...(join.length > 0 ? [...join, ""] : []),
    `test(${lit(`session ${session.fingerprint}`)}, async () => {`,
    ...body,
    "});",
    "",
  ].join("\n");
}
