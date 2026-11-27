import { entryDependency } from "@keel/compiler/internal/entry/entryDependency";
import { isRecord } from "../isRecord.ts";
import { surfaceOf } from "../surfaceOf.ts";
import type { Evaluation } from "./Evaluation.ts";

type Level = { readonly route: string; readonly name: string; readonly factory: unknown };

/** A kernel internal the evaluation loads: the project's package, else the CLI's own dependency (`entryDependency`). */
const kernel = (id: string, root: string): string => entryDependency(id, root, import.meta.url) ?? id;

/** The `stores` factory a binding's `loader` names, else none. */
const factoryOf = (binding: Readonly<Record<string, unknown>> | undefined): unknown => {
  const l = binding?.loader;
  return isRecord(l) && typeof l.stores === "function" ? l.stores : undefined;
};

/** Each bound route's chain of loaders naming `stores` (k.server E1550), outermost first, following `layout`. */
function chainsOf(byId: ReadonlyMap<string, Readonly<Record<string, unknown>>>): Level[][] {
  return [...byId.keys()].map((id) => {
    const levels: Level[] = [];
    const seen = new Set<string>();
    for (let at: string | undefined = id; at !== undefined && !seen.has(at); ) {
      seen.add(at);
      const binding = byId.get(at);
      const factory = factoryOf(binding);
      if (typeof factory === "function") levels.unshift({ route: at, name: factory.name, factory });
      const up = binding?.layout;
      at = typeof up === "string" ? up : undefined;
    }
    return levels;
  });
}

/**
 * The one evaluation of a project's evaluated views (k.derived Derivations), returned as data only: `routes.json`'s
 * entries, the surface without its callers (k.compat Surface: `contracts` with `callers` empty, `stores`), the
 * Keel-coded problem lines (E1000, E1006, E1550, ...) and the absolute path of every file it loaded. One esbuild bundle
 * of the contracts, route tables and store factories is imported once (`evaluateViews` of `@keel/compiler/routes`,
 * loaded only here); the bindings are read with the bundle's own `@keel/router/internal` and the stores with its
 * `@keel/store/internal`, each `stores` factory run once on a sim ctx (`storeShapes`, `storeIdClashes` for E1550).
 * It runs in this process; it reads only what the bundle loads and writes nothing but the bundle's temporary file.
 */
export async function evaluateTree(root: string): Promise<Evaluation> {
  const { evaluateViews } = await import("@keel/compiler/routes");
  const internals = { router: kernel("@keel/router/internal", root), store: kernel("@keel/store/internal", root) };
  const r = await evaluateViews(root, internals);
  const problems = [...r.problems];
  const live = isRecord(r.surface) ? r.surface : {};
  const contracts: unknown[] = Array.isArray(live.contracts) ? [...live.contracts] : [];
  const tables: unknown[] = Array.isArray(live.tables) ? live.tables : [];
  const router = isRecord(live.router) ? live.router : {};
  const store = isRecord(live.store) ? live.store : {};
  const bindings: unknown[] = [];
  const byId = new Map<string, Readonly<Record<string, unknown>>>();
  for (const t of tables) {
    if (isRecord(t) && Array.isArray(t.contracts)) contracts.push(...t.contracts);
    if (typeof router.bindingsOf !== "function") continue;
    let bound: unknown;
    try {
      bound = router.bindingsOf(t);
    } catch {
      bound = undefined;
    }
    if (bound instanceof Map)
      for (const [id, b] of bound)
        if (isRecord(b)) {
          bindings.push(b.binding);
          if (typeof id === "string" && isRecord(b.binding)) byId.set(id, b.binding);
        }
  }
  const clashes = store.storeIdClashes;
  if (typeof clashes === "function")
    for (const m of clashes(chainsOf(byId))) if (typeof m === "string") problems.push(`E1550 ${m}`);
  const shapes = store.storeShapes;
  const storesOf = (factory: unknown): unknown => (typeof shapes === "function" ? shapes(factory) : undefined);
  const surface = surfaceOf({ contracts, bindings, callers: {}, storesOf });
  return { routes: r.routes, surface, problems: [...new Set(problems)], inputs: r.inputs };
}
