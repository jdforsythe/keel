import type { A11yEntry } from "@keel/compiler";
import type { Ctx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import type { Scope } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import type { CaughtError } from "@keel/runtime-dom";
import { harnessed, hosts } from "@keel/runtime-dom/internal";
import type { Snapshot, Store } from "@keel/store";
import type { A11yNode } from "../types/A11yNode.ts";
import type { Found } from "../types/Found.ts";
import type { Harness } from "../types/Harness.ts";
import type { SentRequest } from "../types/SentRequest.ts";
import type { TestEvent } from "../types/TestEvent.ts";
import type { HarnessSetup } from "./HarnessSetup.ts";
import { actsFor } from "./actsFor.ts";
import { asMain } from "./asMain.ts";
import { controlValue } from "./controlValue.ts";
import { fail } from "./fail.ts";
import { focusOrder } from "./focusOrder.ts";
import { nameOf } from "./nameOf.ts";
import { nodeOf } from "./nodeOf.ts";
import { onTestEnd } from "./onTestEnd.ts";
import { pageRoots } from "./pageRoots.ts";
import { recordDocuments } from "./recordDocuments.ts";
import { renderChecks } from "./renderChecks.ts";
import { requestLog } from "./requestLog.ts";
import { resolve } from "./resolve.ts";
import { roleOf } from "./roleOf.ts";
import { settle } from "./settle.ts";
import { stateOf } from "./stateOf.ts";
import { storeValues } from "./storeValues.ts";
import { treeOf } from "./treeOf.ts";
import { unexpected } from "./unexpected.ts";
import { watchOf } from "./watchOf.ts";

/**
 * Mount `view` through runtime-dom (`ctx`, root-Boundary `onError`), or run `start`, inside a scope, in a container
 * on `document.body`, and build the harness; with `documents`, the page's document navigations are recorded there
 * (`recordDocuments`) instead of made. `check()` raises the first root-Boundary catch (`keel.unexpected`), or one `setup.caught` holds,
 * then the render checks (`renderChecks`: E1702 with `a11y`, E1703, E1804 with `tokens`, E1821); `fire` and `settle` run it after settling,
 * with E1826 over the elements the root held at the last check unless `place` changed since. `dispose` unmounts, runs
 * `teardown`, and restores the seeded stores; it runs by itself when the vitest test that opened the harness ends
 * (`onTestEnd`). A mount that throws disposes and rethrows.
 */
export function openHarness(setup: HarnessSetup): { readonly harness: Harness<Ctx>; check(after?: boolean): void } {
  const { ctx, seeded, artifacts, busy, teardown, target, registry } = setup;
  const page = setup.page === true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  if (page) pageRoots.add(container);
  const unrecord =
    setup.documents === undefined ? undefined : recordDocuments(container, setup.documents, setup.follow);
  let unmount: (() => void) | undefined;
  let owner: Scope | undefined;
  let gone = false;
  const log = setup.log ?? requestLog(ctx.net);
  const caught: CaughtError[] = setup.caught ?? [];
  const dispose = (): void => {
    if (gone) return;
    gone = true;
    log.close();
    unmount?.();
    owner?.dispose();
    teardown?.();
    unrecord?.();
    container.remove();
    pageRoots.delete(container);
    for (const [st, snap] of seeded) st.restore(snap);
  };
  // The elements the root held and where the page was at the last check: E1826 compares a `fire` or `settle()` with it.
  let held: { readonly elements: ReadonlySet<Element>; readonly at: string | undefined } | undefined;
  const check = (after = false): void => {
    const at = setup.place?.();
    const before = after && held !== undefined && held.at === at ? held.elements : undefined;
    held = { elements: new Set([container, ...Array.from(container.querySelectorAll("*"))]), at };
    const [first] = caught.splice(0);
    if (first !== undefined) throw unexpected(first);
    if (page) asMain(container);
    renderChecks({ root: container, page, target, a11y: artifacts?.["a11y.json"], tokens: artifacts?.tokens, before });
  };
  // A handle made while a test runs ends with that test (k.test-run Disposal); `dispose` does nothing a second time.
  onTestEnd(dispose);
  // A host element rendered on this ctx never runs its code (k.host-element Harness and replay).
  harnessed().add(ctx);
  if (setup.run !== undefined) harnessed().add(setup.run);
  try {
    owner = scope(() => {
      if ("start" in setup) setup.start(container);
      else
        unmount = mount(setup.view, container, {
          ctx: setup.run ?? ctx,
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
    const name = nameOf(el, role);
    const entry = hosts.get(el);
    if (entry !== undefined) return { id: el.id, role, name, text: "", state: {}, value: entry.value() };
    const found: Found = { id: el.id, role, name, text: (el.textContent ?? "").trim(), state: stateOf(el, role) };
    const value = controlValue(el);
    return value === undefined ? found : { ...found, value };
  };

  /** Run `act` and settle, rethrowing the first error the window reported meanwhile. */
  const step = async (act: () => void): Promise<void> => {
    const errors: unknown[] = [];
    const onError = (e: Event): void => {
      errors.push(e instanceof ErrorEvent ? e.error : e);
      e.preventDefault();
    };
    const win = document.defaultView;
    win?.addEventListener("error", onError);
    try {
      await settle(container, act, busy, registry, watchOf(ctx));
    } finally {
      win?.removeEventListener("error", onError);
    }
    const [first] = errors;
    if (errors.length > 0) throw first;
  };

  const fire = async (id: string, event: TestEvent): Promise<void> => {
    live();
    const el = resolve(container, id);
    for (const act of actsFor(el, id, event)) {
      await step(act);
      if (gone) return;
    }
    check(true);
  };

  const settleNow = async (): Promise<void> => {
    live();
    await settle(container, () => undefined, busy, registry, watchOf(ctx));
    if (!gone) check(true);
  };

  const requests = (): readonly SentRequest[] => {
    live();
    return log.entries();
  };

  const order = (): readonly string[] => {
    live();
    return focusOrder(container);
  };

  return {
    harness: { ctx, a11y: tree, state, fire, settle: settleNow, find, focusOrder: order, requests, dispose },
    check,
  };
}
