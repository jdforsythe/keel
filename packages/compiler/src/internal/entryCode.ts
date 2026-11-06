// Specifiers of the generated client entry. It is app code that runs in the browser; the compiler itself
// never imports these packages (they are later in tooling/deps.json).
const CTX = "@keel/ctx";
const ROUTER = "@keel/router";
const RUNTIME = "@keel/runtime-dom";

const q = (s: string): string => JSON.stringify(s);

/**
 * The generated `/@keel/entry.ts` of a `client` deployable (k.server Topology, k.runtime): imports the atomic
 * CSS, builds a real ctx, merges the modules' route manifests (`routesFiles`, root-relative, `/`-prefixed),
 * starts the router on the browser history, and mounts its `App` into `#app` with the ctx.
 */
export function entryCode(routesFiles: readonly string[], cssId: string): string {
  const imports = routesFiles.map((f, i) => `import { routes as __keelRoutes${i} } from ${q(f)};`);
  const names = routesFiles.map((_, i) => `__keelRoutes${i}`);
  const table =
    names.length === 1 ? (names[0] ?? "") : `manifest({ ${names.map((n) => `...${n}.routes`).join(", ")} })`;
  return [
    `import ${q(cssId)};`,
    `import { createCtx } from ${q(CTX)};`,
    `import { browserHistory, createRouter, manifest } from ${q(ROUTER)};`,
    `import { mount } from ${q(RUNTIME)};`,
    ...imports,
    `const ctx = createCtx({ mode: "real" });`,
    `const router = createRouter(${table}, { ctx, history: browserHistory() });`,
    `const el = document.getElementById("app");`,
    `if (el === null) throw new Error("keel: index.html has no #app element");`,
    "mount(router.App, el, { ctx });",
    "",
  ].join("\n");
}
