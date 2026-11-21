// @vitest-environment happy-dom
// Spec: k.aria, Conformance "`fire(id, { type: 'keydown', key: 'ArrowDown' })` calls `onKey` with `{ key: 'ArrowDown', shift: false, alt: false, mod: false }`; a true return cancels the event, a false one does not."
// Seed: 1337.
// `fire` is the @keel/testing harness call; here the same event is dispatched on the element so the delegated table (k.runtime) is the path under test.
// Behavior extras: `KeyInput` is `{ key, shift, alt, mod }`; `onClick`, `onFocus`, `onBlur` and `onInput` on `combobox`.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { Part } from "@keel/ui/aria";
import fc from "fast-check";
import { afterEach, describe, expect, test } from "vitest";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

const SEED = 1337;
type KeyInput = { key: string; shift: boolean; alt: boolean; mod: boolean };

const hosts: HTMLElement[] = [];
afterEach(() => {
  for (const h of hosts.splice(0)) h.remove();
});
const render = (make: () => Node): { host: HTMLElement; off: () => void } => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  hosts.push(host);
  return { host, off: mount(make, host, { ctx: simCtx }) };
};
const byId = (host: HTMLElement, id: string): Element => {
  const el = host.querySelector(`[id="${id}"]`);
  if (el === null) throw new Error(`no element ${id}`);
  return el;
};
const keydown = (el: Element, init: KeyboardEventInit): KeyboardEvent => {
  const ev = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(ev);
  return ev;
};
const listbox = (onKey: (k: KeyInput) => boolean): Node =>
  Part({ id: "lb", role: "listbox", label: "Fruit", onKey, children: () => "o" });

describe("k.aria: onKey", () => {
  test("`fire(id, { type: 'keydown', key: 'ArrowDown' })` calls `onKey` with `{ key: 'ArrowDown', shift: false, alt: false, mod: false }`", () => {
    const seen: KeyInput[] = [];
    const { host, off } = render(() =>
      listbox((k) => {
        seen.push(k);
        return false;
      }),
    );
    keydown(byId(host, "lb"), { key: "ArrowDown" });
    expect(seen).toEqual([{ key: "ArrowDown", shift: false, alt: false, mod: false }]);
    off();
  });

  test("a true return from `onKey` cancels the event, a false one does not", () => {
    for (const result of [true, false]) {
      const { host, off } = render(() => listbox(() => result));
      const ev = keydown(byId(host, "lb"), { key: "ArrowDown" });
      expect(ev.defaultPrevented).toBe(result);
      off();
      host.remove();
    }
  });

  test("`KeyInput` carries the DOM `key`, and `mod` is Ctrl or Meta", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Escape", "a", "Z"),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (key, shiftKey, altKey, ctrlKey, metaKey) => {
          const seen: KeyInput[] = [];
          const { host, off } = render(() =>
            listbox((k) => {
              seen.push(k);
              return false;
            }),
          );
          keydown(byId(host, "lb"), { key, shiftKey, altKey, ctrlKey, metaKey });
          expect(seen).toEqual([{ key, shift: shiftKey, alt: altKey, mod: ctrlKey || metaKey }]);
          off();
          host.remove();
        },
      ),
      { seed: SEED, numRuns: 60 },
    );
  });

  test("`onClick`, `onFocus` and `onBlur` run on click, focus and blur", () => {
    const calls: string[] = [];
    const { host, off } = render(() =>
      Part({
        id: "b",
        role: "button",
        controls: "p",
        onClick: () => calls.push("click"),
        onFocus: () => calls.push("focus"),
        onBlur: () => calls.push("blur"),
        children: () => "Go",
      }),
    );
    const el = byId(host, "b");
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new FocusEvent("focus"));
    el.dispatchEvent(new FocusEvent("blur"));
    expect(calls).toEqual(["click", "focus", "blur"]);
    off();
  });

  test("`onInput` on `combobox` receives the value", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z ]{0,10}$/), (value) => {
        const seen: string[] = [];
        const { host, off } = render(() =>
          Part({
            id: "c",
            role: "combobox",
            label: "Fruit",
            expanded: false,
            controls: "lb",
            onInput: (v) => seen.push(v),
          }),
        );
        const el = byId(host, "c");
        Reflect.set(el, "value", value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        expect(seen).toEqual([value]);
        off();
        host.remove();
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});
