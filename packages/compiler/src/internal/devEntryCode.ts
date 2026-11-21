import fs from "node:fs";
import path from "node:path";
import { stdRoutes } from "../std/stdRoutes.ts";
import type { Topology } from "../types/Topology.ts";

/** Specifiers the dev module imports; the app resolves them (the compiler itself never imports them). */
const [RELOAD, DOM, UNCAUGHT, SERVER, CTX, CTX_NODE, ROUTER, ROUTER_INTERNAL] = [
  "@keel/compiler/inspect/inspectorsReload",
  "@keel/server/internal/dom",
  "@keel/server/internal/onUncaught",
  "@keel/server",
  "@keel/ctx",
  "@keel/ctx/node",
  "@keel/router",
  "@keel/router/internal",
].map((x) => JSON.stringify(x));

/**
 * The `keel dev` server module (k.topology Local topology): after installing the server DOM, marking the inspector
 * sections registered by an earlier evaluation as carried over (`inspectorsReload`) and installing the process's
 * uncaught-error listeners (`onUncaught` in dev: each records E1577 with the thrown text and serving goes on), it creates one dev
 * `createApp` per `node` deployable of `topology`, each with its own real `ctx` whose storage is the file
 * `.keel-dev/<name>.storage.json`, the `routeTable` of its modules' bindings (an app module's `routes.ts`, a stdlib
 * module's package `./routes` export: `stdRoutes`) and runners, the `.keel/` artifacts and `std.json`, the project's `identity.server.ts`
 * (k.user) when it exists, and the
 * others as in-process peers. It exports `apps`, `[name, app, served, mount]` per
 * deployable, `served(path)` telling whether a route of that deployable (an API route included) matches the path and
 * `mount` the identity source's `handle.path` (`undefined` without one). Each `createApp` takes `origins`, every
 * deployable's `origins` in `topology` (the static read's, k.origins), written as JSON, never the runtime value's.
 */
export function devEntryCode(root: string, topology: Topology): string {
  const abs = (rel: string): string => JSON.stringify(path.join(root, rel).split(path.sep).join("/"));
  const has = (rel: string): boolean => fs.existsSync(path.join(root, rel));
  const node = Object.keys(topology)
    .sort()
    .filter((n) => topology[n]?.adapter === "node");
  const lines = [
    `import { installServerDom } from ${DOM};`,
    `import { inspectorsReload } from ${RELOAD};`,
    "installServerDom();",
    "inspectorsReload();",
    `const log = { format: "compact", write: (l) => process.stdout.write(l + "\\n") };`,
    `(await import(${UNCAUGHT})).onUncaught(log, ${abs(".keel")}, true, () => undefined);`,
    `const { createApp } = await import(${SERVER});`,
    `const { createCtx } = await import(${CTX});`,
    `const { fileStorage } = await import(${CTX_NODE});`,
    `const { routeTable } = await import(${ROUTER});`,
    `const { compileRoutes, matchUrl } = await import(${ROUTER_INTERNAL});`,
    `const { default: topology } = await import(${abs("topology.ts")});`,
    "const made = {};",
    "const peers = {};",
    `for (const n of ${JSON.stringify(node)}) peers[n] = { fetch: (req) => made[n].fetch(req), close: async () => {} };`,
    "export const apps = [];",
  ];
  const origins = JSON.stringify(
    Object.fromEntries(Object.entries(topology).flatMap(([n, d]) => (d.origins === undefined ? [] : [[n, d.origins]]))),
  );
  const std = has(".keel/std.json") ? `, std: ${abs(".keel/std.json")}` : "";
  const id = has("identity.server.ts") ? ", identity" : "";
  if (id !== "") lines.push(`const { default: identity } = await import(${abs("identity.server.ts")});`);
  for (const name of node) {
    const mods = topology[name]?.modules ?? [];
    const files = mods.flatMap((m) => {
      const file = has(`modules/${m}/routes.ts`) ? path.join(root, `modules/${m}/routes.ts`) : stdRoutes(root, m)?.[0];
      return file === undefined ? [] : [file.split(path.sep).join("/")];
    });
    const runners = mods.filter((m) => has(`modules/${m}/runners.server.ts`));
    const imports = files.map((f) => `(await import(${JSON.stringify(f)})).routes`);
    const run = runners.map(
      (m) => `${JSON.stringify(m)}: (await import(${abs(`modules/${m}/runners.server.ts`)})).runners`,
    );
    lines.push(
      "{",
      `  const routes = routeTable(${imports.join(", ")});`,
      "  const table = compileRoutes(routes).located;",
      `  const others = Object.fromEntries(Object.entries(peers).filter(([n]) => n !== ${JSON.stringify(name)}));`,
      `  made[${JSON.stringify(name)}] = await createApp({ topology, origins: ${origins}, deployable: ${JSON.stringify(name)}, routes, ctx: createCtx({ mode: "real", drivers: { storage: fileStorage(${abs(`.keel-dev/${name}.storage.json`)}) } }), mode: "dev", runners: { ${run.join(", ")} }, peers: others, artifacts: ${abs(".keel")}${std}${id}, log });`,
      `  apps.push([${JSON.stringify(name)}, made[${JSON.stringify(name)}], (p) => matchUrl(table, p).route !== null, ${id === "" ? "undefined" : "identity.handle?.path"}]);`,
      "}",
    );
  }
  return `${lines.join("\n")}\n`;
}
