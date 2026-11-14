import fs from "node:fs";
import path from "node:path";
import { stdRoutes } from "../std/stdRoutes.ts";

/** Specifiers the generated entry imports; the app resolves them (the compiler itself never imports them). */
const DOM = JSON.stringify("@keel/server/internal/dom");
const START = JSON.stringify("@keel/server/internal/start");

/**
 * The generated production entry of `node` deployable `name` (k.deploy Build), a virtual module never written as a
 * source file: it installs the server DOM (`@keel/server/internal/dom`, before any component module builds its templates), then
 * imports `topology.ts`, each of `modules`' routes (an app module's `routes.ts` under `root`, a stdlib module's
 * package `./routes` export: `stdRoutes`) and `runners.server.ts` that exist, and, for `storage` `'sqlite'` or
 * `'postgres'` (k.deploy Storage), the `@keel/std-db` driver named, and calls `start` (`@keel/server/internal/start`)
 * with them, the driver as `open` and its own folder.
 */
export function serverEntryCode(
  root: string,
  name: string,
  modules: readonly string[],
  storage: "file" | "sqlite" | "postgres" = "file",
): string {
  const abs = (rel: string): string => JSON.stringify(path.join(root, rel).split(path.sep).join("/"));
  const has = (rel: string): boolean => fs.existsSync(path.join(root, rel));
  const lines = [
    `import { installServerDom } from ${DOM};`,
    "installServerDom();",
    `const { start } = await import(${START});`,
    `const { default: topology } = await import(${abs("topology.ts")});`,
  ];
  const routes: string[] = [];
  const runners: string[] = [];
  modules.forEach((m, i) => {
    const file = has(`modules/${m}/routes.ts`) ? path.join(root, `modules/${m}/routes.ts`) : stdRoutes(root, m)?.[0];
    if (file !== undefined) {
      lines.push(`const { routes: routes${i} } = await import(${JSON.stringify(file.split(path.sep).join("/"))});`);
      routes.push(`routes${i}`);
    }
    if (has(`modules/${m}/runners.server.ts`)) {
      lines.push(`const { runners: runners${i} } = await import(${abs(`modules/${m}/runners.server.ts`)});`);
      runners.push(`${JSON.stringify(m)}: runners${i}`);
    }
  });
  const open = storage === "file" ? "" : ", open";
  if (open !== "")
    lines.push(`const { ${storage}: open } = await import(${JSON.stringify(`@keel/std-db/${storage}`)});`);
  lines.push(
    `await start({ topology, deployable: ${JSON.stringify(name)}, routes: [${routes.join(", ")}], runners: { ${runners.join(", ")} }${open}, dir: import.meta.dirname });`,
  );
  return `${lines.join("\n")}\n`;
}
