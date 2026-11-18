import type { RoutesImport } from "../types/RoutesImport.ts";

/**
 * A client module graph of its own (k.testing Harness): the vitest module registry is reset, then `load` runs, so every
 * workspace module it reaches is evaluated anew, `@keel/store` and its module registry included; `resume`, `stores`
 * and `scope` come from that graph.
 */
export async function freshGraph(load: RoutesImport) {
  (await import("vitest")).vi.resetModules();
  const { routes } = (await load()).default;
  const { resume } = await import("@keel/runtime-dom/ops");
  const { stores } = await import("@keel/store");
  const { scope } = await import("@keel/reactive");
  return { routes, resume, stores, scope };
}
