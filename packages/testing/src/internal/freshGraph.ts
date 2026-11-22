import type { RoutesImport } from "../types/RoutesImport.ts";

/**
 * A client module graph of its own (k.testing Harness): the vitest module registry is reset, then `load` runs, so every
 * workspace module it reaches is evaluated anew, `@keel/store` and its module registry included; the table's bindings
 * (`compileRoutes`, `matchHref`, `encodeHref`), `resume`, `stores` and `scope` come from that graph. A ctx's
 * observers and meta are shared by every `@keel/ctx` copy in the realm, so a page in the new graph hears what the
 * test's ctx reports (a `net` change, k.ctx Observers).
 */
export async function freshGraph(load: RoutesImport) {
  (await import("vitest")).vi.resetModules();
  const mod = await load();
  const routes = "default" in mod ? mod.default : mod.routes;
  // The table was made by the new graph's router, which alone has compiled it.
  const { compileRoutes, encodeHref } = await import("@keel/router/internal");
  const { matchHref } = await import("@keel/router/match");
  const { resume } = await import("@keel/runtime-dom/ops");
  const { stores } = await import("@keel/store");
  const { scope } = await import("@keel/reactive");
  return { routes, table: compileRoutes(routes).table, compileRoutes, matchHref, encodeHref, resume, stores, scope };
}
