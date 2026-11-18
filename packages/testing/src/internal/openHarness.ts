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
import { asMain } from "./asMain.ts";
import { eventFor } from "./eventFor.ts";
import { fail } from "./fail.ts";
import { focusOrder } from "./focusOrder.ts";
import { moveFocus } from "./moveFocus.ts";
import { nameOf } from "./nameOf.ts";
import { nodeOf } from "./nodeOf.ts";
import { renderChecks } from "./renderChecks.ts";
import { resolve } from "./resolve.ts";
import { roleOf } from "./roleOf.ts";
import { settle } from "./settle.ts";
import { stateOf } from "./stateOf.ts";
import { storeValues } from "./storeValues.ts";
import { treeOf } from "./treeOf.ts";
import { unexpected } from "./unexpected.ts";

/**
 * Mount `view` through runtime-dom (`ctx`, root-Boundary `onError`), or run `start`, inside a scope, in a container
 * on `document.body`, and build the harness. `check()` raises the first root-Boundary catch (`keel.unexpected`),
 * then the render checks (`renderChecks`: E1702 with `a11y`, E1703, E1804 with `tokens`, E1821); `fire` and `settle` run it after settling. `dispose` unmounts, runs
 * `teardown`, and restores the seeded stores. A mount that throws disposes and rethrows.
 */
export function openHarness(setup: HarnessSetup): { readonly harness: Harness; check(): void } {
  const { ctx, seeded, a11y, tokens, busy, teardown, target, registry } = setup;
  const page = setup.page === true;
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
    if (page) asMain(container);
    renderChecks({
      root: container,
      page,
      target,
      ...(a11y === undefined ? {} : { a11y }),
      ...(tokens === undefined ? {} : { tokens }),
    });
  };
  try {
    owner = scope(() => {
      if ("start" in setup) setup.start(container);
      else
        unmount = mount(setup.view, container, {
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

  function tree(): readonly A11yNode[];
  function tree(id: string): A11yNode;
  function tree(id?: string): A11yNode | readonly A11yNode[] {
    live();
    return id === undefined ? treeOf(container) : nodeOf(resolve(container, id));
  }

  function state(): Readonly<Record<string, unknown>>;
  function state<T>(store: Store<T>): T;
  function state<T>(store?: Store<T>): T | Readonly<Record<string, unknown>> {
    return store === undefined ? storeValues(registry?.()) : store.snapshot().state;
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
    const act =
      event.type === "focus" || event.type === "blur"
        ? moveFocus(el, event.type)
        : () => {
            el.dispatchEvent(eventFor(el, event));
          };
    const errors: unknown[] = [];
    const onError = (e: Event): void => {
      errors.push(e instanceof ErrorEvent ? e.error : e);
      e.preventDefault();
    };
    const win = document.defaultView;
    win?.addEventListener("error", onError);
    try {
      await settle(container, act, busy, registry);
    } finally {
      win?.removeEventListener("error", onError);
    }
    const [first] = errors;
    if (errors.length > 0) throw first;
    if (!gone) check();
  };

  const settleNow = async (): Promise<void> => {
    live();
    await settle(container, () => undefined, busy, registry);
    if (!gone) check();
  };

  const order = (): readonly string[] => {
    live();
    return focusOrder(container);
  };

  return { harness: { a11y: tree, state, fire, settle: settleNow, find, focusOrder: order, dispose }, check };
}
