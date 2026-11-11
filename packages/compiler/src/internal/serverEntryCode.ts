import fs from "node:fs";
import path from "node:path";

/** Specifiers the generated entry imports; the app resolves them (the compiler itself never imports them). */
const DOM = JSON.stringify("@keel/server/dom");
const START = JSON.stringify("@keel/server/start");

/**
 * The generated production entry of `node` deployable `name` (k.topology Build), a virtual module never written as a
 * source file: it installs the server DOM (`@keel/server/dom`, before any component module builds its templates), then
 * imports `topology.ts`, each of `modules`' `routes.ts` and `runners.server.ts` that exist under `root`, and calls
 * `start` (`@keel/server/start`) with them and its own folder.
 */
export function serverEntryCode(root: string, name: string, modules: readonly string[]): string {
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
    if (has(`modules/${m}/routes.ts`)) {
      lines.push(`const { routes: routes${i} } = await import(${abs(`modules/${m}/routes.ts`)});`);
      routes.push(`routes${i}`);
    }
    if (has(`modules/${m}/runners.server.ts`)) {
      lines.push(`const { runners: runners${i} } = await import(${abs(`modules/${m}/runners.server.ts`)});`);
      runners.push(`${JSON.stringify(m)}: runners${i}`);
    }
  });
  lines.push(
    `await start({ topology, deployable: ${JSON.stringify(name)}, routes: [${routes.join(", ")}], runners: { ${runners.join(", ")} }, dir: import.meta.dirname });`,
  );
  return `${lines.join("\n")}\n`;
}
