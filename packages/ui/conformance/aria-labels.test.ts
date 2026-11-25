// @vitest-environment happy-dom
// Spec: k.aria, clause "`label` writes `aria-label` and `labelledBy` `aria-labelledby`; a signal bound to `expanded` changes only that attribute."
// Seed: 1337.
// Roles paragraph prop rules (exactly one of `label` and `labelledBy`, booleans as "true"/"false", `disabled` on `button` and `input` versus `aria-disabled`) are the extra tests below.
import { createCtx } from "@keel/ctx";
import { computed as newComputed, signal as newSignal, scope } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { Part } from "@keel/ui/aria";
import fc from "fast-check";
import { afterEach, describe, expect, expectTypeOf, test } from "vitest";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

/** Signals and computeds are created in a scope (k.reactive E1203). */
const owner = scope(() => undefined);
const signal = <T>(v: T) => owner.run(() => newSignal(v));
const computed = <T>(fn: () => T) => owner.run(() => newComputed(fn));

const SEED = 1337;
type PartProps = Parameters<typeof Part>[0];
type Of<R extends string> = Extract<PartProps, { role: R }>;

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
const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const attrs = (el: Element): Record<string, string> =>
  Object.fromEntries(Array.from(el.attributes, (a) => [a.name, a.value]));

describe("k.aria: labels", () => {
  test("`label` writes `aria-label`", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,15}$/), (label) => {
        const { host, off } = render(() => Part({ id: "x", role: "group", label, children: () => "g" }));
        expect(byId(host, "x").getAttribute("aria-label")).toBe(label);
        expect(byId(host, "x").hasAttribute("aria-labelledby")).toBe(false);
        off();
        host.remove();
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  test("`labelledBy` writes `aria-labelledby`", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z][a-z0-9.-]{0,11}$/), (ref) => {
        const { host, off } = render(() => Part({ id: "x", role: "tabpanel", labelledBy: ref, children: () => "p" }));
        expect(byId(host, "x").getAttribute("aria-labelledby")).toBe(ref);
        expect(byId(host, "x").hasAttribute("aria-label")).toBe(false);
        off();
        host.remove();
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  test("a signal bound to `expanded` changes only that attribute", async () => {
    const expanded = signal(false);
    const { host, off } = render(() => Part({ id: "x", role: "combobox", label: "Fruit", expanded, controls: "lb" }));
    const el = byId(host, "x");
    expect(el.getAttribute("aria-expanded")).toBe("false");
    const before = attrs(el);
    expanded.set(true);
    await flush();
    const after = attrs(el);
    expect(after["aria-expanded"]).toBe("true");
    expect({ ...after, "aria-expanded": "false" }).toEqual(before);
    expanded.set(false);
    await flush();
    expect(attrs(el)).toEqual(before);
    off();
  });

  test("wherever a role takes `label` it takes `labelledBy` instead, exactly one", () => {
    expectTypeOf<Of<"tablist">>().toHaveProperty("label");
    expectTypeOf<Of<"group">>().toHaveProperty("labelledBy");
    expectTypeOf<Of<"table">>().toHaveProperty("labelledBy");
    expectTypeOf<Of<"checkbox">>().toHaveProperty("labelledBy");
    const both = { id: "x", role: "group", label: "a", labelledBy: "b" } as const;
    expectTypeOf(both).not.toExtend<PartProps>();
    expectTypeOf({ id: "x", role: "group" } as const).not.toExtend<PartProps>();
    expect(true).toBe(true);
  });

  test("a boolean prop writes the string `true` or `false`", () => {
    fc.assert(
      fc.property(fc.boolean(), (selected) => {
        const { host, off } = render(() => Part({ id: "x", role: "option", selected, children: () => "o" }));
        expect(byId(host, "x").getAttribute("aria-selected")).toBe(selected ? "true" : "false");
        off();
        host.remove();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  test("`controls`, `describedBy` and `activeDescendant` write `aria-controls`, `aria-describedby` and `aria-activedescendant`", () => {
    const { host, off } = render(() =>
      Part({ id: "x", role: "combobox", label: "C", expanded: true, controls: "lb", activeDescendant: "o1" }),
    );
    expect(byId(host, "x").getAttribute("aria-controls")).toBe("lb");
    expect(byId(host, "x").getAttribute("aria-activedescendant")).toBe("o1");
    off();
    const d = render(() =>
      Part({ id: "y", role: "alertdialog", labelledBy: "h", open: false, describedBy: "desc", children: () => "d" }),
    );
    expect(byId(d.host, "y").getAttribute("aria-describedby")).toBe("desc");
    d.off();
  });

  test("`disabled` writes the attribute on `button` and `input` and `aria-disabled` elsewhere", () => {
    const btn = render(() => Part({ id: "b", role: "button", controls: "p", disabled: true, children: () => "b" }));
    expect(byId(btn.host, "b").hasAttribute("disabled")).toBe(true);
    expect(byId(btn.host, "b").hasAttribute("aria-disabled")).toBe(false);
    const opt = render(() => Part({ id: "o", role: "option", selected: false, disabled: true, children: () => "o" }));
    expect(byId(opt.host, "o").getAttribute("aria-disabled")).toBe("true");
    expect(byId(opt.host, "o").hasAttribute("disabled")).toBe(false);
    btn.off();
    opt.off();
  });

  test("each prop takes a value, a signal or a computed, bound as k.ui binds `value`", async () => {
    const selected = signal(false);
    const { host, off } = render(() => Part({ id: "x", role: "option", selected, children: () => "o" }));
    expect(byId(host, "x").getAttribute("aria-selected")).toBe("false");
    selected.set(true);
    await flush();
    expect(byId(host, "x").getAttribute("aria-selected")).toBe("true");
    const open = signal(false);
    const c = render(() =>
      Part({ id: "y", role: "option", selected: computed(() => open.get()), children: () => "o" }),
    );
    open.set(true);
    await flush();
    expect(byId(c.host, "y").getAttribute("aria-selected")).toBe("true");
    off();
    c.off();
  });
});
