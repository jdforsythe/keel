import { type Ctx, createCtx } from "@keel/ctx";
import { clip } from "./internal/clip.ts";
import { fail } from "./internal/fail.ts";
import { harnessArtifacts } from "./internal/harnessArtifacts.ts";
import { openHarness } from "./internal/openHarness.ts";
import { seedFrom } from "./internal/seedFrom.ts";
import { seedStores } from "./internal/seedStores.ts";
import type { Harness } from "./types/Harness.ts";
import type { RenderOptions } from "./types/RenderOptions.ts";
import type { RenderProps } from "./types/RenderProps.ts";
import type { TestComponent } from "./types/TestComponent.ts";

/**
 * A component `render` takes: one whose props are `A`, and which a schema's parsed `P` with the props `A` adds beyond
 * the schema also fits. The compiler checks the second at each call, with the component's own types.
 */
type Renderable<P, A extends P> = TestComponent<P, A> & ((props: P & Omit<A, keyof P>, ctx: Ctx) => Node);

/**
 * Render `component` for a test (k.testing Harness). `props` is parsed by `component.Props` and every
 * `[store, value]` in `state` by its store schema before anything renders (`schema.invalid`). The render uses
 * `options.ctx`, else a sim ctx seeded from `KEEL_SEED` (default 1337), and mounts through `@keel/runtime-dom`
 * inside a scope. After the first render and every `fire`: a root-Boundary catch (`mount` `onError`) fails with
 * `keel.unexpected`; then the render checks of k.a11y (E1702 with
 * `artifacts["a11y.json"]`, axe-core element rules E1703, E1804 with `artifacts.tokens`, E1821), recorded for
 * `reports/a11y.json`. `dispose` puts every seeded store back to its snapshot from before the render. The handle's
 * `ctx` is typed as the one it runs on: `SimCtx` when none is given, else the given ctx's type.
 */
export function render<P, A extends P = P>(
  component: Renderable<P, A>,
  options: RenderOptions<RenderProps<P, NoInfer<A>>> & { readonly ctx?: undefined },
): Harness;
export function render<P, A extends P, C extends Ctx>(
  component: Renderable<P, A>,
  options: RenderOptions<RenderProps<P, NoInfer<A>>> & { readonly ctx: C },
): Harness<C>;
export function render<P, A extends P = P>(
  component: Renderable<P, A>,
  options: RenderOptions<RenderProps<P, NoInfer<A>>>,
): Harness<Ctx>;
export function render<P, A extends P = P>(
  component: Renderable<P, A>,
  options: RenderOptions<RenderProps<P, A>>,
): Harness<Ctx> {
  const schema = component.Props;
  if (schema === undefined) throw fail("schema.invalid", "component has no Props (export `Props` from its file)", null);
  const parsed = schema.parse(options.props);
  if (!parsed.ok) throw fail("schema.invalid", `props: ${clip(parsed.error.message, 80)}`, parsed.error.data);
  const artifacts = harnessArtifacts(options.artifacts);
  const seeded = seedStores(options.state ?? []);
  const ctx = options.ctx ?? createCtx({ mode: "sim", seed: seedFrom(undefined) });
  const name = component.name === "" ? "anonymous" : component.name;
  const { harness, check } = openHarness({
    // The parsed props over the given ones: the schema's values as it parsed them, the callback and slot props as given.
    view: () => component({ ...options.props, ...parsed.value }, ctx),
    ctx,
    seeded,
    target: () => ({ route: null, component: name }),
    artifacts,
  });
  try {
    check();
  } catch (error) {
    harness.dispose();
    throw error;
  }
  return harness;
}
