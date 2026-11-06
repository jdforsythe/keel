import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import type { Scope } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import type { Store } from "@keel/store";
import { assertAccessible } from "./internal/assertAccessible.ts";
import { clip } from "./internal/clip.ts";
import { eventFor } from "./internal/eventFor.ts";
import { fail } from "./internal/fail.ts";
import { nameOf } from "./internal/nameOf.ts";
import { nodeOf } from "./internal/nodeOf.ts";
import { resolve } from "./internal/resolve.ts";
import { roleOf } from "./internal/roleOf.ts";
import { rootError } from "./internal/rootError.ts";
import { seedFrom } from "./internal/seedFrom.ts";
import { seedStores } from "./internal/seedStores.ts";
import { settle } from "./internal/settle.ts";
import { stateOf } from "./internal/stateOf.ts";
import { storeValues } from "./internal/storeValues.ts";
import { treeOf } from "./internal/treeOf.ts";
import type { A11yNode } from "./types/A11yNode.ts";
import type { Found } from "./types/Found.ts";
import type { Harness } from "./types/Harness.ts";
import type { RenderOptions } from "./types/RenderOptions.ts";
import type { TestComponent } from "./types/TestComponent.ts";
import type { TestEvent } from "./types/TestEvent.ts";

/**
 * Render `component` for a test (k.testing Harness). `props` is parsed by `component.Props` and every
 * `[store, value]` in `state` by its store schema before anything renders (`schema.invalid`). The render uses
 * `options.ctx`, else a sim ctx seeded from `KEEL_SEED` (default 1337), mounts through `@keel/runtime-dom`
 * inside a scope, and fails with E1703 when the result breaks an axe rule. A throw the mount's root Boundary
 * catches (render here, handlers and effects in `fire`) fails the call with `keel.unexpected`.
 */
export function render<P>(component: TestComponent<P>, options: RenderOptions): Harness {
  const parsed = component.Props.parse(options.props);
  if (!parsed.ok) throw fail("schema.invalid", `props: ${clip(parsed.error.message, 80)}`, parsed.error.data);
  seedStores(options.state ?? []);
  const ctx = options.ctx ?? createCtx({ mode: "sim", seed: seedFrom(undefined) });
  const container = document.createElement("div");
  document.body.appendChild(container);
  let unmount: (() => void) | undefined;
  let owner: Scope | undefined;
  let gone = false;
  const dispose = (): void => {
    if (gone) return;
    gone = true;
    unmount?.();
    owner?.dispose();
    container.remove();
  };
  try {
    owner = scope(() => {
      unmount = mount(() => component(parsed.value, undefined, ctx), container, { ctx });
    });
    const caught = rootError(container);
    if (caught !== undefined) throw caught;
    assertAccessible(container);
  } catch (error) {
    dispose();
    throw error;
  }

  const live = (): void => {
    if (gone) throw fail("E1705", "the render was disposed; no ids remain", {});
  };

  function a11y(): readonly A11yNode[];
  function a11y(id: string): A11yNode;
  function a11y(id?: string): A11yNode | readonly A11yNode[] {
    live();
    return id === undefined ? treeOf(container) : nodeOf(resolve(container, id));
  }

  function state(): Readonly<Record<string, unknown>>;
  function state<T>(store: Store<T>): T;
  function state<T>(store?: Store<T>): T | Readonly<Record<string, unknown>> {
    return store === undefined ? storeValues() : store.snapshot().state;
  }

  const find = (id: string): Found => {
    live();
    const el = resolve(container, id);
    const role = roleOf(el);
    return { id: el.id, role, name: nameOf(el, role), text: (el.textContent ?? "").trim(), state: stateOf(el, role) };
  };

  const fire = async (id: string, event: TestEvent): Promise<void> => {
    live();
    const el = resolve(container, id);
    const errors: unknown[] = [];
    const onError = (e: Event): void => {
      errors.push(e instanceof ErrorEvent ? e.error : e);
      e.preventDefault();
    };
    const win = document.defaultView;
    win?.addEventListener("error", onError);
    try {
      el.dispatchEvent(eventFor(el, event));
      const quiet = await settle(() => `${container.innerHTML}\n${JSON.stringify(storeValues())}`);
      if (!quiet) throw new Error(`k.testing: fire(${JSON.stringify(id)}, ${event.type}) did not settle in 100 turns`);
    } finally {
      win?.removeEventListener("error", onError);
    }
    const [first] = errors;
    if (errors.length > 0) throw first;
    if (gone) return;
    const caught = rootError(container);
    if (caught !== undefined) throw caught;
    assertAccessible(container);
  };

  return { a11y, state, fire, find, dispose };
}
