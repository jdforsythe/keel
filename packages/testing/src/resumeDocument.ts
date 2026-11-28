import { type Ctx, createCtx } from "@keel/ctx";
import { holdOn } from "@keel/ctx/internal";
import { scope } from "@keel/reactive";
import { compileRoutes } from "@keel/router/internal";
import { resume } from "@keel/runtime-dom/ops";
import type { Island } from "@keel/runtime-dom/ops";
import type { Snapshot, Store } from "@keel/store";
import { stores } from "@keel/store";
import { fail } from "./internal/fail.ts";
import { freshGraph } from "./internal/freshGraph.ts";
import { harnessArtifacts } from "./internal/harnessArtifacts.ts";
import { notInE2e } from "./internal/notInE2e.ts";
import { openHarness } from "./internal/openHarness.ts";
import { seedFrom } from "./internal/seedFrom.ts";
import type { DocumentNavigation } from "./types/DocumentNavigation.ts";
import type { ResumeDocumentOptions } from "./types/ResumeDocumentOptions.ts";
import type { ResumedHarness } from "./types/ResumedHarness.ts";

/**
 * Resume a server-rendered document for a test (k.testing Harness): its `<body>`, scripts dropped but `#k-state`,
 * goes into the harness container, and `resume` (k.runtime, as the generated entry calls it) attaches each island's
 * component from route table `options.routes` (by route id; a manifest or `routeTable`) with `options.ctx` (default: a sim ctx) and every live store. With
 * `routes` as an import function the document resumes in a module graph of its own (`freshGraph`): that graph's
 * `resume`, components and stores, so the test's own module stores are neither read nor written. A resume
 * warning (an island with no component in `routes`, state that fails its schema) rejects with E1720 naming the first.
 * Resolves with the `render` handle after the first settle and the `render` checks; `dispose` puts every store back.
 * The handle's `removed()` and `detached()` count the served elements under island roots (the roots included) that
 * are out of the document when it resolves, and that a MutationObserver saw taken out until then; both are fixed then.
 * `documents()` lists the document navigations the page started, recorded and not made (k.mount Testing). The
 * handle's `ctx` is typed as `render`'s: `SimCtx` when none is given.
 */
export function resumeDocument(
  html: string,
  options: ResumeDocumentOptions & { readonly ctx?: undefined },
): Promise<ResumedHarness>;
export function resumeDocument<C extends Ctx>(
  html: string,
  options: ResumeDocumentOptions & { readonly ctx: C },
): Promise<ResumedHarness<C>>;
export function resumeDocument(html: string, options: ResumeDocumentOptions): Promise<ResumedHarness<Ctx>>;
export async function resumeDocument(html: string, options: ResumeDocumentOptions): Promise<ResumedHarness<Ctx>> {
  notInE2e("resumeDocument");
  const artifacts = harnessArtifacts(options.artifacts);
  const given = options.routes;
  const ctx = options.ctx ?? createCtx({ mode: "sim", seed: seedFrom(undefined) });
  // The test runner answers the import over a channel made before the run: the load is held (k.drive Seams).
  const graph =
    typeof given === "function"
      ? await holdOn(ctx.clock)("resumeDocument", () => freshGraph(given))
      : { table: compileRoutes(given).table, resume, stores, scope };
  const live = graph.stores();
  const seeded: (readonly [Store<unknown>, Snapshot<unknown>])[] = [...live.values()].map((st) => [
    st,
    st.snapshot({ meta: true }),
  ]);
  const components: Record<string, Island> = {};
  for (const [id, { def }] of graph.table) if (def.component) components[id] = def.component;
  const body = new DOMParser().parseFromString(html, "text/html").body;
  for (const s of body.querySelectorAll("script:not(#k-state)")) s.remove();
  const warnings: string[] = [];
  // The islands' scope in the graph's own reactive engine, which the harness scope does not own.
  const islands: { dispose: () => void } = { dispose: () => undefined };
  // The served elements under island roots, and a MutationObserver over the container while resume runs.
  const served = new Set<Element>();
  const seen: MutationRecord[] = [];
  const observer = new MutationObserver((records) => void seen.push(...records));
  const documents: DocumentNavigation[] = [];
  const { harness } = openHarness({
    start: (container) => {
      container.append(...body.childNodes);
      for (const el of container.querySelectorAll("[data-k-island], [data-k-island] *")) served.add(el);
      observer.observe(container, { childList: true, subtree: true });
      islands.dispose = graph.scope(() => {
        warnings.push(...graph.resume(container, components, { ctx, stores: Object.fromEntries(live) }).warnings);
      }).dispose;
    },
    ctx,
    seeded,
    registry: graph.stores,
    documents,
    teardown: () => islands.dispose(),
    target: () => ({ route: null, component: "resumeDocument" }),
    artifacts,
  });
  try {
    const [first] = warnings;
    if (first !== undefined) throw fail("E1720", `the document did not resume: ${first}`, { warnings });
    await harness.settle();
  } catch (error) {
    harness.dispose();
    throw error;
  }
  seen.push(...observer.takeRecords());
  observer.disconnect();
  const out = new Set<Element>();
  for (const r of seen)
    for (const n of r.removedNodes)
      if (n instanceof Element) for (const el of [n, ...n.querySelectorAll("*")]) if (served.has(el)) out.add(el);
  const removed = [...served].filter((el) => !el.isConnected).length;
  return Object.assign(harness, { removed: () => removed, detached: () => out.size, documents: () => [...documents] });
}
