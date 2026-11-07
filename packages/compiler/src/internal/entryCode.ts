import { INSPECT_PATH } from "../inspect/INSPECT_PATH.ts";

// Specifiers of the generated client entry. It is app code that runs in the browser; the compiler itself
// never imports these packages (they are later in tooling/deps.json).
const CTX = "@keel/ctx";
const ROUTER = "@keel/router";
const RUNTIME = "@keel/runtime-dom";
const REACTIVE = "@keel/reactive";
const STORE = "@keel/store";
const SECTIONS = "@keel/compiler/inspect/inspectorSections";

const q = (s: string): string => JSON.stringify(s);

/**
 * The generated `/@keel/entry.ts` of a `client` deployable (k.server Topology, k.runtime): imports the atomic
 * CSS, builds a real ctx, merges the modules' route manifests (`routesFiles`, root-relative, `/`-prefixed),
 * starts the router on the browser history, and mounts its `App` into `#app` with the ctx. In a dev build
 * (`import.meta.env.DEV`) it then posts the live half of the inspect document (`{ graph, stores, sections }`, k.cli Inspect; `sections` are the registered inspector hooks read with `ctx`) to
 * `/__keel/inspect`: once after mount, then at most once a second when it changed. An interval rather than an
 * `effect`, so the reporter is not part of the graph it reports.
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
    `import { inspect } from ${q(REACTIVE)};`,
    `import { stores } from ${q(STORE)};`,
    `import { inspectorSections } from ${q(SECTIONS)};`,
    ...imports,
    `const ctx = createCtx({ mode: "real" });`,
    `const router = createRouter(${table}, { ctx, history: browserHistory() });`,
    `const el = document.getElementById("app");`,
    `if (el === null) throw new Error("keel: index.html has no #app element");`,
    "mount(router.App, el, { ctx });",
    "if (import.meta.env.DEV) {",
    '  let last = "";',
    "  const report = () => {",
    "    const live = {};",
    "    for (const [id, st] of stores()) {",
    "      const snap = st.snapshot();",
    "      live[id] = { state: snap.state, log: snap.log };",
    "    }",
    "    const body = JSON.stringify({ graph: inspect(), stores: live, sections: inspectorSections(ctx).sections });",
    "    if (body === last) return;",
    "    last = body;",
    `    const sent = fetch(${q(INSPECT_PATH)}, { method: "POST", headers: { "content-type": "application/json" }, body });`,
    '    sent.catch(() => { last = ""; });',
    "  };",
    "  report();",
    "  setInterval(report, 1000);",
    "}",
    "",
  ].join("\n");
}
