import type { A11yEntry } from "@keel/compiler";
import type { Ctx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import type { Scope } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import type { UnexpectedError } from "@keel/runtime-dom";
import type { Snapshot, Store } from "@keel/store";
import type { A11yNode } from "../types/A11yNode.ts";
import type { Found } from "../types/Found.ts";
import type { Harness } from "../types/Harness.ts";
import type { TestEvent } from "../types/TestEvent.ts";
import type { HarnessSetup } from "./HarnessSetup.ts";
import { assertAccessible } from "./assertAccessible.ts";
import { assertArtifacts } from "./assertArtifacts.ts";
import { eventFor } from "./eventFor.ts";
import { fail } from "./fail.ts";
import { nameOf } from "./nameOf.ts";
import { nodeOf } from "./nodeOf.ts";
import { resolve } from "./resolve.ts";
import { roleOf } from "./roleOf.ts";
import { settle } from "./settle.ts";
import { stateOf } from "./stateOf.ts";
import { storeValues } from "./storeValues.ts";
import { treeOf } from "./treeOf.ts";
import { unexpected } from "./unexpected.ts";

/**
 * Mount `view` through runtime-dom (`ctx`, root-Boundary `onError`) inside a scope, in a container on
 * `document.body`, and build the harness. `check()` raises the first root-Boundary catch (`keel.unexpected`),
 * then E1702 against `a11y` (when given), then E1703; `fire` runs it after settling. `dispose` unmounts, runs
 * `teardown`, and restores the seeded stores. A mount that throws disposes and rethrows.
 */
export function openHarness(setup: HarnessSetup): { readonly harness: Harness; check(): void } {
  const { view, ctx, seeded, a11y: expected, busy, teardown } = setup;
  const container = document.createElement("div");
  document.body.appendChild(container);
  let unmount: (() => void) | undefined;
  let owner: Scope | undefined;
  let gone = false;
  const caught: UnexpectedError[] = [];
  const dispose = (): void => {
    if (gone) return;
    gone = true;
    unmount?.();
    owner?.dispose();
    teardown?.();
    container.remove();
    for (const [st, snap] of seeded) st.restore(snap);
  };
  const check = (): void => {
    const [first] = caught.splice(0);
    if (first !== undefined) throw unexpected(first);
    if (expected !== undefined) assertArtifacts(container, expected);
    assertAccessible(container);
  };
  try {
    owner = scope(() => {
      unmount = mount(view, container, {
        ctx,
        onError: (error) => {
          caught.push(error);
        },
      });
    });
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
      await settle(
        container,
        () => {
          el.dispatchEvent(eventFor(el, event));
        },
        busy,
      );
    } finally {
      win?.removeEventListener("error", onError);
    }
    const [first] = errors;
    if (errors.length > 0) throw first;
    if (!gone) check();
  };

  return { harness: { a11y, state, fire, find, dispose }, check };
}
