import { ISLANDS_PATH } from "./ISLANDS_PATH.ts";

/**
 * The generated resume entry of a server-rendered (`node` or `static`) deployable (k.runtime): imports the island
 * components by route id from `/@keel/islands.ts` (with `deployable`, `/@keel/islands.ts?d=<deployable>`, that
 * deployable's islands; k.server Build) and calls `resume` on the body with a real ctx, the registered stores, so
 * `#k-state` snapshots restore, and `mode`, a string literal: `"dev"` only when Vite serves, else `"production"` (a build,
 * or the text a node `createApp` serves unbundled); the entry reads no `import.meta.env`. Before resuming it binds the `std` of `#k-state` to the ctx (`bindClientStd`, k.module
 * Std config); imports are hoisted, so every std schema has registered first. `resume` then reports the served route
 * of `#k-state` as the ctx's first `nav`, and inputs made before it as `fire` events, so a recorder started in an
 * island sees the page's route and every input. Each warning `resume` returns goes to `console.warn`, one line, in
 * every mode (k.claim Client).
 * App-independent, so a node `createApp` serves the same text the Vite plugin does; Vite resolves its imports (dev
 * server, `vite build`). Kernel specifiers are app code that runs in the browser; the compiler itself never imports them.
 */
export function resumeEntry(deployable?: string, mode: "dev" | "production" = "production"): string {
  const islands = deployable === undefined ? ISLANDS_PATH : `${ISLANDS_PATH}?d=${encodeURIComponent(deployable)}`;
  return [
    'import { bindClientStd } from "@keel/compiler/std/bindClientStd";',
    'import { createCtx } from "@keel/ctx";',
    'import { resume } from "@keel/runtime-dom/ops";',
    'import { stores } from "@keel/store";',
    `import { components } from ${JSON.stringify(islands)};`,
    'const ctx = createCtx({ mode: "real" });',
    'bindClientStd(ctx, document.getElementById("k-state")?.textContent);',
    `const mode = ${JSON.stringify(mode)};`,
    "for (const w of resume(document.body, components, { ctx, stores: Object.fromEntries(stores()), mode }).warnings) console.warn(w);",
    "",
  ].join("\n");
}
