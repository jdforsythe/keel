import fs from "node:fs";
import path from "node:path";
import { stdRoutes } from "../std/stdRoutes.ts";
import type { Origins } from "../types/Origins.ts";

/** Specifiers the generated entry imports; the app resolves them (the compiler itself never imports them). */
const DOM = JSON.stringify("@keel/server/internal/dom");
const START = JSON.stringify("@keel/server/internal/start");
const PRERENDER = JSON.stringify("@keel/server/internal/prerender");
const ROUTER = JSON.stringify("@keel/router");

/**
 * The generated production entry of `node` deployable `name` (k.deploy Build), a virtual module never written as a
 * source file: it installs the server DOM (`@keel/server/internal/dom`, before any component module builds its templates), then
 * imports `topology.ts`, each of `modules`' bindings (an app module's `routes.ts` under `root`, a stdlib module's
 * package `./routes` export: `stdRoutes`), unioned by `routeTable` (`@keel/router`) in `modules` order, `runners.server.ts` and the project's `identity.server.ts` (k.user) that
 * exist, and calls `start`
 * (`@keel/server/internal/start`) with them and its own folder, which it first sets as `KEEL_APP_DIR` when that is unset
 * (k.data Files); for `storage` `'sqlite'` or `'postgres'` (k.deploy
 * Storage), `open` imports the `@keel/std-db` driver named when `start` first calls it, so `start` checks the Node
 * version before the driver loads. `origins`, every deployable's declaration as the static read of `topology.ts`
 * accepted it (k.origins), is written into the entry as JSON and handed to `start`, so the served policies hold no
 * origin the runtime value of `topology.ts` adds.
 *
 * For a `static` deployable (k.hosting Static) the entry is the build's, never shipped: it imports no runners and no
 * driver, sets no `KEEL_APP_DIR`, and exports `render(dir, std)`, which calls `prerender` (`@keel/server/internal/prerender`)
 * with the same inputs, `dir`, the deployable's client build, and `std`, the path of `.keel/std.json` or undefined.
 */
export function serverEntryCode(
  root: string,
  name: string,
  modules: readonly string[],
  storage: "file" | "sqlite" | "postgres" = "file",
  origins: Readonly<Record<string, Origins>> = {},
  adapter: "node" | "static" = "node",
): string {
  const built = adapter === "static";
  const abs = (rel: string): string => JSON.stringify(path.join(root, rel).split(path.sep).join("/"));
  const has = (rel: string): boolean => fs.existsSync(path.join(root, rel));
  const lines = [
    `import { installServerDom } from ${DOM};`,
    "installServerDom();",
    // The app folder (k.data Files): this file's own, where the build copied the served modules' `migrations/`.
    ...(built ? [] : ["process.env.KEEL_APP_DIR ||= import.meta.dirname;"]),
    built ? `const { prerender } = await import(${PRERENDER});` : `const { start } = await import(${START});`,
    `const { routeTable } = await import(${ROUTER});`,
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
    if (!built && has(`modules/${m}/runners.server.ts`)) {
      lines.push(`const { runners: runners${i} } = await import(${abs(`modules/${m}/runners.server.ts`)});`);
      runners.push(`${JSON.stringify(m)}: runners${i}`);
    }
  });
  const id = has("identity.server.ts") ? ", identity" : "";
  if (id !== "") lines.push(`const { default: identity } = await import(${abs("identity.server.ts")});`);
  if (built) {
    lines.push(
      `export const render = (dir, std) => prerender({ topology, origins: ${JSON.stringify(origins)}, deployable: ${JSON.stringify(name)}, routes: routeTable(${routes.join(", ")})${id}, dir, std });`,
    );
    return `${lines.join("\n")}\n`;
  }
  const open = storage === "file" ? "" : ", open";
  if (open !== "")
    lines.push(
      `const open = (url) => import(${JSON.stringify(`@keel/std-db/${storage}`)}).then((m) => m.${storage}(url));`,
    );
  lines.push(
    `await start({ topology, origins: ${JSON.stringify(origins)}, deployable: ${JSON.stringify(name)}, routes: routeTable(${routes.join(", ")}), runners: { ${runners.join(", ")} }${open}${id}, dir: import.meta.dirname });`,
  );
  return `${lines.join("\n")}\n`;
}
