import { INSPECT_PATH } from "../inspect/INSPECT_PATH.ts";
import type { StdData } from "../types/StdData.ts";

// Specifiers of the generated client entry. It is app code that runs in the browser; the compiler itself
// never imports these packages (they are later in tooling/deps.json).
const CTX = "@keel/ctx";
const ROUTER = "@keel/router";
const RUNTIME = "@keel/runtime-dom";
const REACTIVE = "@keel/reactive";
const STORE = "@keel/store";
const SECTIONS = "@keel/compiler/inspect/inspectorSections";
const BIND_STD = "@keel/compiler/std/bindStd";

const q = (s: string): string => JSON.stringify(s);
/** The std.shells package and drivers factory of each shell (k.shell Shell ctx). */
const SHELLS = {
  capacitor: ["@keel/std-capacitor", "capacitorDrivers"],
  tauri: ["@keel/std-tauri", "tauriDrivers"],
} as const;

/**
 * The generated `/@keel/entry.ts` of a `client` deployable (k.server Topology, k.runtime): imports the atomic
 * CSS, builds a real ctx, merges the modules' route manifests (`routesFiles`, root-relative, `/`-prefixed),
 * binds `std` (the client-readable part of the build's `std.json`, embedded as a JSON literal; nothing when empty) to the ctx
 * (k.module Std config, rfc:0069), binds `service({ module })` for every module of `deployables` (deployable -> its modules) to
 * the origin its deployable's `keel-peer` tag in the document names, else the document's origin (k.hosting Peers),
 * starts the router on the browser history, and mounts its `App` into `#app` with
 * the ctx and `mode`: `"dev"` when `import.meta.env?.DEV` is `true`, else `"production"` (k.runtime). In a dev build
 * (`import.meta.env.DEV`) it then posts the live half of the inspect document (`{ graph, stores, sections }`, k.cli Inspect; `sections` are the registered inspector hooks read with `ctx`) to
 * `/__keel/inspect`: once after mount, then at most once a second when it changed. An interval rather than an
 * `effect`, so the reporter is not part of the graph it reports. With `shell` (a `keel build --target` build, k.shell
 * Shell ctx) the ctx is `createCtx({ mode: 'shell', drivers })`, the drivers of that shell's std.shells package for
 * the build's `origin` (`KEEL_ORIGIN`).
 */
export function entryCode(
  routesFiles: readonly string[],
  cssId: string,
  std: StdData = {},
  deployables: Readonly<Record<string, readonly string[]>> = {},
  shell?: { readonly kind: keyof typeof SHELLS; readonly origin: string },
): string {
  const native = shell === undefined ? undefined : SHELLS[shell.kind];
  const bind = Object.keys(std).length > 0;
  const peers = Object.keys(deployables).length > 0;
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
    ...(bind ? [`import { bindStd } from ${q(BIND_STD)};`] : []),
    ...(native === undefined ? [] : [`import { ${native[1]} as __keelDrivers } from ${q(native[0])};`]),
    ...imports,
    native === undefined
      ? `const ctx = createCtx({ mode: "real" });`
      : `const ctx = createCtx({ mode: "shell", drivers: __keelDrivers({ origin: new URL(${q(shell?.origin ?? "")}) }) });`,
    ...(bind ? [`bindStd(ctx, ${JSON.stringify(std)});`] : []),
    ...(peers
      ? [
          `const __keelTags = new Map(Array.from(document.querySelectorAll('meta[name="keel-peer"]'), (m) => [m.dataset.deployable, m.content]));`,
          `const __keelKey = Symbol.for("keel.modules");`,
          "const __keelTable = globalThis[__keelKey] instanceof WeakMap ? globalThis[__keelKey] : new WeakMap();",
          "globalThis[__keelKey] = __keelTable;",
          `__keelTable.set(ctx, new Map(Object.entries(${JSON.stringify(deployables)}).flatMap(([d, ms]) => ms.map((m) => [m, __keelTags.get(d) ?? location.origin]))));`,
        ]
      : []),
    `const router = createRouter(${table}, { ctx, history: browserHistory() });`,
    `const el = document.getElementById("app");`,
    `if (el === null) throw new Error("keel: index.html has no #app element");`,
    'const mode = import.meta.env?.DEV === true ? "dev" : "production";',
    "mount(router.App, el, { ctx, mode });",
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
