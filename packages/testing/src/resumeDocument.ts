import { createCtx } from "@keel/ctx";
import type { RouteDef } from "@keel/router";
import { resume } from "@keel/runtime-dom/ops";
import type { Island } from "@keel/runtime-dom/ops";
import type { Snapshot, Store } from "@keel/store";
import { stores } from "@keel/store";
import { fail } from "./internal/fail.ts";
import { openHarness } from "./internal/openHarness.ts";
import { seedFrom } from "./internal/seedFrom.ts";
import type { Harness } from "./types/Harness.ts";
import type { ResumeDocumentOptions } from "./types/ResumeDocumentOptions.ts";

/**
 * Resume a server-rendered document for a test (k.testing Harness): its `<body>`, scripts dropped but `#k-state`,
 * goes into the harness container, and `resume` (k.runtime, as the generated entry calls it) attaches each island's
 * component from `options.routes` (by route id) with `options.ctx` (default: a sim ctx) and every live store. A resume
 * warning (an island with no component in `routes`, state that fails its schema) rejects with E1720 naming the first.
 * Resolves with the `render` handle after the first settle and the `render` checks; `dispose` puts every store back.
 */
export async function resumeDocument<M extends Readonly<Record<string, RouteDef>>>(
  html: string,
  options: ResumeDocumentOptions<M>,
): Promise<Harness> {
  const ctx = options.ctx ?? createCtx({ mode: "sim", seed: seedFrom(undefined) });
  const live = stores();
  const seeded: (readonly [Store<unknown>, Snapshot<unknown>])[] = [...live.values()].map((st) => [
    st,
    st.snapshot({ meta: true }),
  ]);
  const components: Record<string, Island> = {};
  for (const [id, def] of Object.entries(options.routes.routes)) if (def.component) components[id] = def.component;
  const body = new DOMParser().parseFromString(html, "text/html").body;
  for (const s of body.querySelectorAll("script:not(#k-state)")) s.remove();
  const warnings: string[] = [];
  const a11y = options.artifacts?.["a11y.json"];
  const tokens = options.artifacts?.tokens;
  const { harness } = openHarness({
    start: (container) => {
      container.append(...body.childNodes);
      warnings.push(...resume(container, components, { ctx, stores: Object.fromEntries(live) }).warnings);
    },
    ctx,
    seeded,
    target: () => ({ route: null, component: "resumeDocument" }),
    ...(a11y === undefined ? {} : { a11y }),
    ...(tokens === undefined ? {} : { tokens }),
  });
  try {
    const [first] = warnings;
    if (first !== undefined) throw fail("E1720", `the document did not resume: ${first}`, { warnings });
    await harness.settle();
  } catch (error) {
    harness.dispose();
    throw error;
  }
  return harness;
}
