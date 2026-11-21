import { createCtx } from "@keel/ctx";
import { withCallbacks } from "../unsafe/withCallbacks.ts";
import { clip } from "./internal/clip.ts";
import { fail } from "./internal/fail.ts";
import { openHarness } from "./internal/openHarness.ts";
import { seedFrom } from "./internal/seedFrom.ts";
import { seedStores } from "./internal/seedStores.ts";
import type { Harness } from "./types/Harness.ts";
import type { RenderOptions } from "./types/RenderOptions.ts";
import type { TestComponent } from "./types/TestComponent.ts";

/**
 * Render `component` for a test (k.testing Harness). `props` is parsed by `component.Props` and every
 * `[store, value]` in `state` by its store schema before anything renders (`schema.invalid`). The render uses
 * `options.ctx`, else a sim ctx seeded from `KEEL_SEED` (default 1337), and mounts through `@keel/runtime-dom`
 * inside a scope. After the first render and every `fire`: a root-Boundary catch (`mount` `onError`) fails with
 * `keel.unexpected`; then the render checks of k.a11y (E1702 with
 * `artifacts["a11y.json"]`, axe-core element rules E1703, E1804 with `artifacts.tokens`, E1821), recorded for
 * `reports/a11y.json`. `dispose` puts every seeded store back to its snapshot from before the render.
 */
export function render<P, A extends P = P>(component: TestComponent<P, A>, options: RenderOptions): Harness {
  const schema = component.Props;
  if (schema === undefined) throw fail("schema.invalid", "component has no Props (export `Props` from its file)", null);
  const parsed = schema.parse(options.props);
  if (!parsed.ok) throw fail("schema.invalid", `props: ${clip(parsed.error.message, 80)}`, parsed.error.data);
  const seeded = seedStores(options.state ?? []);
  const ctx = options.ctx ?? createCtx({ mode: "sim", seed: seedFrom(undefined) });
  const name = component.name === "" ? "anonymous" : component.name;
  const { harness, check } = openHarness({
    view: () => component(withCallbacks<P, A>(parsed.value), undefined, ctx),
    ctx,
    seeded,
    target: () => ({ route: null, component: name }),
    artifacts: options.artifacts,
  });
  try {
    check();
  } catch (error) {
    harness.dispose();
    throw error;
  }
  return harness;
}
