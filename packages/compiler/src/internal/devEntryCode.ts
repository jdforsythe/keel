import fs from "node:fs";
import path from "node:path";
import type { Topology } from "../types/Topology.ts";

/** Specifiers the dev module imports; the app resolves them (the compiler itself never imports them). */
const [DOM, SERVER, CTX, ROUTER, ROUTER_INTERNAL] = [
  "@keel/server/dom",
  "@keel/server",
  "@keel/ctx",
  "@keel/router",
  "@keel/router/internal",
].map((x) => JSON.stringify(x));

/**
 * The `keel dev` server module (k.topology Local topology): after installing the server DOM it creates one dev
 * `createApp` per `node` deployable of `topology`, each with its own real `ctx`, its modules' routes and runners, the
 * `.keel/` artifacts and `std.json`, and the others as in-process peers. It exports `apps`, `[name, app, served]` per
 * deployable, `served(path)` telling whether a route of that deployable (an API route included) matches the path.
 */
export function devEntryCode(root: string, topology: Topology): string {
  const abs = (rel: string): string => JSON.stringify(path.join(root, rel).split(path.sep).join("/"));
  const has = (rel: string): boolean => fs.existsSync(path.join(root, rel));
  const node = Object.keys(topology)
    .sort()
    .filter((n) => topology[n]?.adapter === "node");
  const lines = [
    `import { installServerDom } from ${DOM};`,
    "installServerDom();",
    `const { createApp } = await import(${SERVER});`,
    `const { createCtx } = await import(${CTX});`,
    `const { manifest } = await import(${ROUTER});`,
    `const { compileRoutes, compileTable, matchUrl } = await import(${ROUTER_INTERNAL});`,
    `const { default: topology } = await import(${abs("topology.ts")});`,
    "const made = {};",
    "const peers = {};",
    `for (const n of ${JSON.stringify(node)}) peers[n] = { fetch: (req) => made[n].fetch(req), close: async () => {} };`,
    "export const apps = [];",
  ];
  const std = has(".keel/std.json") ? `, std: ${abs(".keel/std.json")}` : "";
  for (const name of node) {
    const mods = topology[name]?.modules ?? [];
    const routes = mods.filter((m) => has(`modules/${m}/routes.ts`));
    const runners = mods.filter((m) => has(`modules/${m}/runners.server.ts`));
    const imports = routes.map((m) => `...(await import(${abs(`modules/${m}/routes.ts`)})).routes.routes`);
    const run = runners.map(
      (m) => `${JSON.stringify(m)}: (await import(${abs(`modules/${m}/runners.server.ts`)})).runners`,
    );
    lines.push(
      "{",
      `  const routes = manifest({ ${imports.join(", ")} });`,
      "  const table = compileTable(compileRoutes(routes.routes), routes.routes);",
      `  const others = Object.fromEntries(Object.entries(peers).filter(([n]) => n !== ${JSON.stringify(name)}));`,
      `  made[${JSON.stringify(name)}] = await createApp({ topology, deployable: ${JSON.stringify(name)}, routes, ctx: createCtx({ mode: "real" }), mode: "dev", runners: { ${run.join(", ")} }, peers: others, artifacts: ${abs(".keel")}${std}, log: { format: "compact", write: (l) => process.stdout.write(l + "\\n") } });`,
      `  apps.push([${JSON.stringify(name)}, made[${JSON.stringify(name)}], (p) => matchUrl(table, p).route !== null]);`,
      "}",
    );
  }
  return `${lines.join("\n")}\n`;
}
