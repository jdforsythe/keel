import { createCtx } from "@keel/ctx";
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
 * `keel.unexpected`; with `options.artifacts`, roles and name sources are compared with its `a11y.json` (E1702);
 * axe rules (E1703). `dispose` puts every seeded store back to its snapshot from before the render.
 */
export function render<P>(component: TestComponent<P>, options: RenderOptions): Harness {
  const schema = component.Props;
  if (schema === undefined) throw fail("schema.invalid", "component has no Props (export `Props` from its file)", null);
  const parsed = schema.parse(options.props);
  if (!parsed.ok) throw fail("schema.invalid", `props: ${clip(parsed.error.message, 80)}`, parsed.error.data);
  const seeded = seedStores(options.state ?? []);
  const ctx = options.ctx ?? createCtx({ mode: "sim", seed: seedFrom(undefined) });
  const a11y = options.artifacts?.["a11y.json"];
  const { harness, check } = openHarness({
    view: () => component(parsed.value, undefined, ctx),
    ctx,
    seeded,
    ...(a11y === undefined ? {} : { a11y }),
  });
  try {
    check();
  } catch (error) {
    harness.dispose();
    throw error;
  }
  return harness;
}
