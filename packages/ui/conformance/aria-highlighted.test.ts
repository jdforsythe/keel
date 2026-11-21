// @vitest-environment happy-dom
// Spec: k.aria, Conformance "Setting `activeDescendant` to an option's id gives that option `data-k-highlighted` and removes it from the one before."
// Seed: 1337.
// Behavior extra: the named element is scrolled into view with `block: 'nearest'`.
import { createCtx } from "@keel/ctx";
import { signal as newSignal, scope } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { Part } from "@keel/ui/aria";
import fc from "fast-check";
import { afterEach, describe, expect, test } from "vitest";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

/** Signals and computeds are created in a scope (k.reactive E1203). */
const owner = scope(() => undefined);
const signal = <T>(v: T) => owner.run(() => newSignal(v));

const SEED = 1337;
const IDS = ["o0", "o1", "o2", "o3"] as const;

const hosts: HTMLElement[] = [];
afterEach(() => {
  for (const h of hosts.splice(0)) h.remove();
});
const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const byId = (host: ParentNode, id: string): Element => {
  const el = host.querySelector(`[id="${id}"]`);
  if (el === null) throw new Error(`no element ${id}`);
  return el;
};
const listbox = (active: ReturnType<typeof signal<string>>): Node =>
  Part({
    id: "lb",
    role: "listbox",
    label: "Fruit",
    activeDescendant: active,
    children: () => IDS.map((id) => Part({ id, role: "option", selected: false, children: () => id })),
  });
const setup = (initial: string): { host: HTMLElement; active: ReturnType<typeof signal<string>>; off: () => void } => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  hosts.push(host);
  const active = signal(initial);
  return { host, active, off: mount(() => listbox(active), host, { ctx: simCtx }) };
};
const highlighted = (host: ParentNode): string[] =>
  Array.from(host.querySelectorAll("[data-k-highlighted]"), (e) => e.id);

describe("k.aria: highlighted", () => {
  test("Setting `activeDescendant` to an option's id gives that option `data-k-highlighted` and removes it from the one before", async () => {
    const { host, active, off } = setup("o0");
    await flush();
    expect(highlighted(host)).toEqual(["o0"]);
    active.set("o2");
    await flush();
    expect(byId(host, "o2").hasAttribute("data-k-highlighted")).toBe(true);
    expect(byId(host, "o0").hasAttribute("data-k-highlighted")).toBe(false);
    off();
  });

  test("after any sequence of `activeDescendant` values exactly the last named option is highlighted", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.constantFrom(...IDS), { minLength: 1, maxLength: 8 }), async (seq) => {
        const { host, active, off } = setup("o0");
        for (const id of seq) {
          active.set(id);
          await flush();
          expect(highlighted(host)).toEqual([id]);
          expect(byId(host, "lb").getAttribute("aria-activedescendant")).toBe(id);
        }
        off();
        host.remove();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  test("the option `activeDescendant` names is scrolled into view with `block: 'nearest'`", async () => {
    const { host, active, off } = setup("o0");
    await flush();
    const calls: unknown[] = [];
    const target = byId(host, "o3");
    Reflect.set(target, "scrollIntoView", (arg: unknown) => calls.push(arg));
    active.set("o3");
    await flush();
    expect(calls).toEqual([{ block: "nearest" }]);
    off();
  });
});
