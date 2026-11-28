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
 * every mode (k.claim Client); when `resume` rethrows an island's throw, the warnings it left at
 * `Symbol.for("keel.resumeWarnings")` go first.
 * With `themes` (the app's `choice` themes) it records them for the ctx, so `appearance(ctx)` in the browser knows them.
 * With `cssId` (the Vite plugin's, dev server and `vite build`) it first imports the atomic CSS, so the build's entry
 * chunk names the stylesheet the server head links (k.head Server). Without it the text is app-independent, the one
 * a node `createApp` serves unbundled. Vite resolves its imports. Kernel specifiers are app code that runs in the
 * browser; the compiler itself never imports them.
 */
export function resumeEntry(
  deployable?: string,
  mode: "dev" | "production" = "production",
  cssId?: string,
  themes: readonly string[] = [],
): string {
  const islands = deployable === undefined ? ISLANDS_PATH : `${ISLANDS_PATH}?d=${encodeURIComponent(deployable)}`;
  return [
    ...(cssId === undefined ? [] : [`import ${JSON.stringify(cssId)};`]),
    'import { bindClientStd } from "@keel/compiler/std/bindClientStd";',
    'import { createCtx } from "@keel/ctx";',
    'import { resume } from "@keel/runtime-dom/ops";',
    ...(themes.length === 0 ? [] : ['import { rendered } from "@keel/runtime-dom/internal";']),
    'import { stores } from "@keel/store";',
    `import { components } from ${JSON.stringify(islands)};`,
    'const ctx = createCtx({ mode: "real" });',
    'bindClientStd(ctx, document.getElementById("k-state")?.textContent);',
    // The `choice` themes, kept with the document for this ctx so `appearance(ctx)` knows them (k.schemes Choice).
    ...(themes.length === 0
      ? []
      : [`rendered.set(ctx, { document, artifacts: { themes: ${JSON.stringify(themes)} } });`]),
    `const mode = ${JSON.stringify(mode)};`,
    "let warnings;",
    "try {",
    "  warnings = resume(document.body, components, { ctx, stores: Object.fromEntries(stores()), mode }).warnings;",
    "} catch (error) {",
    '  for (const w of globalThis[Symbol.for("keel.resumeWarnings")] ?? []) console.warn(w);',
    "  throw error;",
    "}",
    "for (const w of warnings) console.warn(w);",
    "",
  ].join("\n");
}
