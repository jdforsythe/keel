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
/** What the entry imports so its router (k.mount) and a shell's runtime (k.return) know the identity mount's path. */
const IDENTITY = "/identity.ts";
/** The std.shells package and drivers factory of each shell (k.shell Shell ctx). */
const SHELLS = {
  capacitor: ["@keel/std-capacitor", "capacitorDrivers"],
  tauri: ["@keel/std-tauri", "tauriDrivers"],
} as const;

/**
 * The generated `/@keel/entry.ts` of a `client` deployable (k.server Topology, k.runtime): imports the atomic
 * CSS, builds a real ctx, unions the modules' bindings with `routeTable` (`routesFiles`, root-relative, `/`-prefixed),
 * binds `std` (the client-readable part of the build's `std.json`, embedded as a JSON literal; nothing when empty) to the ctx
 * (k.module Std config, rfc:0069), binds `service({ contract })` for every module of `deployables` (deployable -> its modules) to
 * the origin its deployable's `keel-peer` tag in the document names, else the document's origin (k.hosting Peers); with
 * `served` (the topology has a `node` deployable, whose origin a tag can name) it reads the tags even when `deployables` is empty,
 * starts the router on the browser history, and mounts its `App` into `#app` with
 * the ctx and `mode`, a string literal: `"dev"` only when Vite serves, `"production"` for a build (k.runtime, k.deploy); the
 * entry reads no `import.meta.env`. Under `"dev"` it then posts the live half of the inspect document (`{ graph, stores, sections }`, k.cli Inspect; `sections` are the registered inspector hooks read with `ctx`) to
 * `/__keel/inspect`: once after mount, then at most once a second when it changed. An interval rather than an
 * `effect`, so the reporter is not part of the graph it reports. With `shell` (a `keel build --target` build, k.shell
 * Shell ctx) the ctx is `createCtx({ mode: 'shell', drivers })`, the drivers of that shell's std.shells package for
 * the build's `origin` (`KEEL_ORIGIN`); with `shell.id` (the project has `identity.ts`, k.return) the entry also
 * imports `identity.ts` and, before the router starts, calls that package's `shellMount` with the shell's `id`, the
 * origin and the identity mount (its default export). With `identity` (the project has `identity.ts`) the entry imports
 * its default export and starts the router with `mount` its `path`, so no page matches at or under it (k.mount). Under
 * `"production"` the reporter is dead code a build drops.
 */
export function entryCode(
  routesFiles: readonly string[],
  cssId: string,
  std: StdData = {},
  deployables: Readonly<Record<string, readonly string[]>> = {},
  shell?: { readonly kind: keyof typeof SHELLS; readonly origin: string; readonly id?: string | undefined },
  mode: "dev" | "production" = "production",
  identity = false,
  served = false,
): string {
  const native = shell === undefined ? undefined : SHELLS[shell.kind];
  const origin = `new URL(${q(shell?.origin ?? "")})`;
  const id = native === undefined ? undefined : shell?.id;
  const bind = Object.keys(std).length > 0;
  const peers = served || Object.keys(deployables).length > 0;
  const imports = routesFiles.map((f, i) => `import { routes as __keelRoutes${i} } from ${q(f)};`);
  const names = routesFiles.map((_, i) => `__keelRoutes${i}`);
  const table = `routeTable(${names.join(", ")})`;
  return [
    `import ${q(cssId)};`,
    `import { createCtx } from ${q(CTX)};`,
    `import { browserHistory, createRouter, routeTable } from ${q(ROUTER)};`,
    `import { mount } from ${q(RUNTIME)};`,
    `import { inspect } from ${q(REACTIVE)};`,
    `import { stores } from ${q(STORE)};`,
    `import { inspectorSections } from ${q(SECTIONS)};`,
    ...(bind ? [`import { bindStd } from ${q(BIND_STD)};`] : []),
    ...(native === undefined ? [] : [`import { ${native[1]} as __keelDrivers } from ${q(native[0])};`]),
    ...(native === undefined || id === undefined
      ? []
      : [`import { shellMount as __keelMount } from ${q(`${native[0]}/shellMount`)};`]),
    ...(identity || id !== undefined ? [`import __keelIdentity from ${q(IDENTITY)};`] : []),
    ...imports,
    native === undefined
      ? `const ctx = createCtx({ mode: "real" });`
      : `const ctx = createCtx({ mode: "shell", drivers: __keelDrivers({ origin: ${origin} }) });`,
    ...(id === undefined ? [] : [`__keelMount(ctx, { id: ${q(id)}, origin: ${origin}, mount: __keelIdentity });`]),
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
    `const mode = ${q(mode)};`,
    `const router = createRouter(${table}, { ctx, history: browserHistory(), mode${identity ? ", mount: __keelIdentity.path" : ""} });`,
    `const el = document.getElementById("app");`,
    `if (el === null) throw new Error("keel: index.html has no #app element");`,
    "mount(router.App, el, { ctx, mode });",
    'if (mode === "dev") {',
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
