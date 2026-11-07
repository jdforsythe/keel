import { ISLANDS_PATH } from "./ISLANDS_PATH.ts";

/**
 * The generated resume entry of a server-rendered (`node` or `static`) deployable (k.runtime, RFC 0046): imports the
 * island components by route id from `/@keel/islands.ts` and calls `resume` on the body with a real ctx and the
 * registered stores, so `#k-state` snapshots restore. App-independent, so a node `createApp` serves the same text the
 * Vite plugin does; Vite resolves its imports (dev server, `vite build`). Kernel specifiers are app code that runs in
 * the browser; the compiler itself never imports them.
 */
export const RESUME_ENTRY = [
  'import { createCtx } from "@keel/ctx";',
  'import { resume } from "@keel/runtime-dom/ops";',
  'import { stores } from "@keel/store";',
  `import { components } from ${JSON.stringify(ISLANDS_PATH)};`,
  'resume(document.body, components, { ctx: createCtx({ mode: "real" }), stores: Object.fromEntries(stores()) });',
  "",
].join("\n");
