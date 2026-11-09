import { ISLANDS_PATH } from "./ISLANDS_PATH.ts";

/**
 * The generated resume entry of a server-rendered (`node` or `static`) deployable (k.runtime, RFC 0046): imports the
 * island components by route id from `/@keel/islands.ts` and calls `resume` on the body with a real ctx and the
 * registered stores, so `#k-state` snapshots restore. Before resuming it binds the `std` of `#k-state` to the ctx
 * (`bindClientStd`, k.module Std config, rfc:0069); imports are hoisted, so every std schema has registered first.
 * `resume` then reports the served route of `#k-state` as the ctx's first `nav`, and inputs made before it as `fire`
 * events (rfc:0071), so a recorder started in an island sees the page's route and every input.
 * App-independent, so a node `createApp` serves the same text the Vite plugin does; Vite resolves its imports (dev
 * server, `vite build`). Kernel specifiers are app code that runs in the browser; the compiler itself never imports them.
 */
export const RESUME_ENTRY = [
  'import { bindClientStd } from "@keel/compiler/std/bindClientStd";',
  'import { createCtx } from "@keel/ctx";',
  'import { resume } from "@keel/runtime-dom/ops";',
  'import { stores } from "@keel/store";',
  `import { components } from ${JSON.stringify(ISLANDS_PATH)};`,
  'const ctx = createCtx({ mode: "real" });',
  'bindClientStd(ctx, document.getElementById("k-state")?.textContent);',
  "resume(document.body, components, { ctx, stores: Object.fromEntries(stores()) });",
  "",
].join("\n");
