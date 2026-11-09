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
/** A serving module's `routes.ts`: the module id and the import specifier from the test file. */
type RoutesImport = { readonly module: string; readonly from: string };

const RESERVED = new Set([
  "createCtx",
  "record",
  "renderRoute",
  "expect",
  "test",
  "manifest",
  "routes",
  "ctx",
  "rec",
  "h",
]);
const lit = (v: JsonValue): string => JSON.stringify(v);
const empty = (o: { readonly [k: string]: JsonValue }): boolean => Object.keys(o).length === 0;

/** `routes.href(id, params?, search?)` with literal arguments, trailing empty objects left out. */
function href(n: NavCall): string {
  const args = [lit(n.id)];
  if (!empty(n.params) || !empty(n.search)) args.push(lit(n.params));
  if (!empty(n.search)) args.push(lit(n.search));
  return `routes.href(${args.join(", ")})`;
}

/**
 * The `@keel/testing` file `keel session to-test` writes for `session` (std.sessions):
 * header `// Session: <fingerprint>, seed <n>`, then one straight-line test (no loops or helpers) that creates a sim
 * ctx of the session's seed (absent: 0), advances the clock to `at`, records, renders the base route with its params,
 * search and the state of each importable store, applies each input in order (`fire` as `h.fire(id, event)`, `nav` as
 * `h.navigate(routes.href(...))` with literal arguments, so a changed route schema fails `tsc`), advancing the clock
 * only where `at` changes, and ends `expect(rec.errors()).toEqual([])`. Stores not in `stores` are left out of
 * `state` (they start from their initial value). Several serving modules are joined with `manifest`.
 */
export function toTest(
  session: Session,
  options: {
    readonly navs: readonly NavCall[];
    readonly stores: readonly StoreImport[];
    readonly routes: readonly RoutesImport[];
  },
): string {
  const seed = session.seed ?? 0;
  const imports = [
    'import { createCtx } from "@keel/ctx";',
    ...(options.routes.length > 1 ? ['import { manifest } from "@keel/router";'] : []),
    'import { record } from "@keel/std-sessions/record";',
    'import { renderRoute } from "@keel/testing";',
    'import { expect, test } from "vitest";',
  ];
  const taken = new Set(RESERVED);
  const local = (want: string): string => {
    let name = taken.has(want) ? `${want}Store` : want;
    for (let i = 2; taken.has(name); i++) name = `${want}Store${i}`;
    taken.add(name);
    return name;
  };
  const seeded: string[] = [];
  for (const st of options.stores) {
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
    join.push(`const routes = manifest({ ${names.map((n) => `...${n}.routes`).join(", ")} });`);
  }
  const body: string[] = [`  const ctx = createCtx({ mode: "sim", seed: ${seed} });`];
  let now = 0;
  const advance = (at: number): void => {
    if (at > now) body.push(`  ctx.clock.advance(${at - now});`);
    now = Math.max(now, at);
  };
  advance(session.at);
  body.push("  const rec = record(ctx);");
  const r = session.route;
  body.push(
    `  const h = await renderRoute(${lit(r.id)}, { routes, params: ${lit(r.params)}, search: ${lit(r.search)}, state: [${seeded.join(", ")}], ctx });`,
  );
  const navs = new Map(options.navs.map((n) => [n.index, n]));
  for (const [i, e] of session.events.entries()) {
    if (e.kind === "fire") {
      advance(e.at);
      body.push(`  await h.fire(${lit(e.id)}, ${lit(e.event)});`);
    } else if (e.kind === "nav") {
      const n = navs.get(i);
      if (n === undefined) continue;
      advance(e.at);
      body.push(`  await h.navigate(${href(n)});`);
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
