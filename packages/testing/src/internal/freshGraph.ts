import type { RoutesImport } from "../types/RoutesImport.ts";
import { vitestApi } from "./vitestApi.ts";

/**
 * A client module graph of its own (k.testing Harness): the vitest module registry is reset, then `load` runs, so every
 * workspace module it reaches is evaluated anew, `@keel/store` and its module registry included; the table's bindings
 * (`compileRoutes`), `resume`, `stores` and `scope` come from that graph.
 */
export async function freshGraph(load: RoutesImport) {
  (await vitestApi()).resetModules();
  const mod = await load();
  const routes = "default" in mod ? mod.default : mod.routes;
  // The table was made by the new graph's router, which alone has compiled it.
  const { compileRoutes } = await import("@keel/router/internal");
  const { resume } = await import("@keel/runtime-dom/ops");
  const { stores } = await import("@keel/store");
  const { scope } = await import("@keel/reactive");
  return { table: compileRoutes(routes).table, resume, stores, scope };
}
