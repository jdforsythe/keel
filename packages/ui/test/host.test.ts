// @vitest-environment happy-dom
// k.host-element Element and Text alternative, k.host-code Code and customElement: what `@keel/ui` renders and makes.
// The lifecycle (mount, update, dispose, the parse) is the runtime's; here `code` is never called by rendering.
// Seed: 1337.
import { createCtx } from "@keel/ctx";
import { scope, signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { s } from "@keel/schema";
import { Host, type HostCode, type HostOut, customElement, hostCode } from "@keel/ui";
import fc from "fast-check";
import { afterEach, describe, expect, expectTypeOf, test } from "vitest";

const SEED = 1337;
const Points = s.object({ points: s.array(s.number()) });
const Pick = s.object({ at: s.number() });
type PointsValue = { readonly points: readonly number[] };

const hosts: HTMLElement[] = [];
afterEach(() => {
  for (const h of hosts.splice(0)) h.remove();
});
const render = (make: () => Node): HTMLElement => {
  const h = document.createElement("div");
  document.body.appendChild(h);
  hosts.push(h);
  mount(make, h, { ctx: createCtx({ mode: "sim", seed: SEED }) });
  const el = h.querySelector("[data-k-host]");
  if (!(el instanceof HTMLElement)) throw new Error("no host element");
  return el;
};
const out = (): HostOut<{ at: number }> & { emitted: { at: number }[]; abort: () => void } => {
  const ac = new AbortController();
  const emitted: { at: number }[] = [];
  return { emit: (e) => emitted.push(e), signal: ac.signal, emitted, abort: () => ac.abort() };
};

describe("Host: the element", () => {
  test("renders an empty `div` with `data-k-host`, `data-k`, `role` and `aria-label`, and never calls `code`", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z]{1,12}$/),
        fc.constantFrom<"img" | "group">("img", "group"),
        (label, role) => {
          let called = 0;
          const el = render(() =>
            Host({
              id: "h.chart",
              role,
              label,
              input: Points,
              value: { points: [1] },
              code: () => {
                called += 1;
                return Promise.reject(new Error("never loaded"));
              },
            }),
          );
          expect(el.tagName).toBe("DIV");
          expect(el.id).toBe("h.chart");
          expect(el.hasAttribute("data-k")).toBe(true);
          expect(el.getAttribute("role")).toBe(role);
          expect(el.getAttribute("aria-label")).toBe(label);
          expect(el.hasAttribute("aria-labelledby")).toBe(false);
          expect(el.childNodes).toHaveLength(0);
          expect(called).toBe(0);
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("`labelledBy` writes `aria-labelledby`, `describedBy` `aria-describedby`; style props write classes", () => {
    const el = render(() =>
      Host({
        id: "h.c",
        role: "group",
        labelledBy: "h.title",
        describedBy: "h.table",
        input: Points,
        value: { points: [] },
        code: () => Promise.reject(new Error("never loaded")),
        w: "full",
      }),
    );
    expect(el.getAttribute("aria-labelledby")).toBe("h.title");
    expect(el.getAttribute("aria-describedby")).toBe("h.table");
    expect(el.hasAttribute("aria-label")).toBe(false);
    expect(el.getAttribute("class")).toContain("w-full");
    expect(el.hasAttribute("style")).toBe(false);
  });

  test("a computed `label` binds `aria-label`", () => {
    const owner = scope(() => undefined, { detached: true });
    const name = owner.run(() => signal("One"));
    const el = render(() =>
      Host({
        id: "h.c",
        role: "img",
        label: name,
        input: Points,
        value: { points: [] },
        code: () => Promise.reject(new Error("never loaded")),
      }),
    );
    expect(el.getAttribute("aria-label")).toBe("One");
    name.set("Two");
    expect(el.getAttribute("aria-label")).toBe("Two");
  });

  test("types: `value` follows `input`; one of `label` and `labelledBy`; `onEvent` comes with `events`", () => {
    type P = Parameters<typeof Host<PointsValue, { at: number }>>[0];
    const code: HostCode<PointsValue, { at: number }> = hostCode({
      mount: (_n: HTMLElement, _v: PointsValue, _o: HostOut<{ at: number }>) => undefined,
      update: () => undefined,
    });
    const base = {
      id: "h",
      role: "img",
      input: Points,
      value: { points: [1] },
      code: () => Promise.resolve(code),
    } as const;
    expectTypeOf({ ...base, label: "C" }).toMatchTypeOf<P>();
    expectTypeOf({ ...base }).not.toMatchTypeOf<P>();
    expectTypeOf({ ...base, label: "C", labelledBy: "t" }).not.toMatchTypeOf<P>();
    expectTypeOf({ ...base, label: "C", onEvent: (_e: { at: number }) => undefined }).not.toMatchTypeOf<P>();
    expectTypeOf({ ...base, label: "C", events: Pick, onEvent: (_e: { at: number }) => undefined }).toMatchTypeOf<P>();
    expectTypeOf({ ...base, label: "C", role: "presentation" }).not.toMatchTypeOf<P>();
    expectTypeOf({ ...base, label: "C", value: { points: "x" } }).not.toMatchTypeOf<P>();
    expect(true).toBe(true);
  });
});

describe("hostCode", () => {
  test("`start` runs `mount` with the node, value and out; `update` and `dispose` get the state `mount` returned", () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), fc.array(fc.integer()), (a, b) => {
        const calls: unknown[][] = [];
        const state = { n: 1 };
        const code = hostCode({
          mount(node: HTMLElement, value: PointsValue, o: HostOut<{ at: number }>) {
            calls.push(["mount", node, value, o]);
            return state;
          },
          update(st: { n: number }, value: PointsValue, prev: PointsValue) {
            calls.push(["update", st, value, prev]);
          },
          dispose(st: { n: number }) {
            calls.push(["dispose", st]);
          },
        });
        const node = document.createElement("div");
        const first: PointsValue = { points: a };
        const next: PointsValue = { points: b };
        const o = out();
        const run = code.start(node, first, o);
        run.update(next, first);
        run.dispose();
        expect(calls).toEqual([
          ["mount", node, first, o],
          ["update", state, next, first],
          ["dispose", state],
        ]);
        expect(calls[1]?.[2]).toBe(next);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("without `dispose`, the returned `dispose` does nothing", () => {
    const code = hostCode({ mount: () => 1, update: () => undefined });
    expect(code.start(document.createElement("div"), 0, out()).dispose()).toBeUndefined();
  });
});

describe("customElement", () => {
  test("creates `tag` as the node's only child, calls `set` at mount and on each update, and removes the child at dispose", () => {
    fc.assert(
      fc.property(fc.array(fc.integer(), { maxLength: 5 }), (writes) => {
        const sets: [HTMLElement, PointsValue][] = [];
        const code = customElement("x-dial", { set: (el: HTMLElement, v: PointsValue) => sets.push([el, v]) });
        const node = document.createElement("div");
        node.append(document.createTextNode("stale"));
        let prev: PointsValue = { points: [] };
        const run = code.start(node, prev, out());
        expect(node.childNodes).toHaveLength(1);
        const child = node.firstElementChild;
        expect(child?.localName).toBe("x-dial");
        for (const n of writes) {
          const v: PointsValue = { points: [n] };
          run.update(v, prev);
          prev = v;
        }
        expect(sets).toHaveLength(1 + writes.length);
        expect(sets.every(([el]) => el === child)).toBe(true);
        run.dispose();
        expect(node.childNodes).toHaveLength(0);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("an `events` entry maps an event dispatched on the child to `emit`; not on the `div`, not after `signal` aborts", () => {
    const code = customElement("x-dial", {
      set: () => undefined,
      events: {
        "dial-pick": (ev: Event) => ({
          at: ev instanceof CustomEvent && typeof ev.detail === "number" ? ev.detail : 0,
        }),
      },
    });
    const node = document.createElement("div");
    const o = out();
    code.start(node, undefined, o);
    const child = node.firstElementChild;
    if (child === null) throw new Error("no child");
    child.dispatchEvent(new CustomEvent("dial-pick", { detail: 3 }));
    node.dispatchEvent(new CustomEvent("dial-pick", { detail: 4 }));
    child.dispatchEvent(new Event("other"));
    expect(o.emitted).toEqual([{ at: 3 }]);
    o.abort();
    child.dispatchEvent(new CustomEvent("dial-pick", { detail: 5 }));
    expect(o.emitted).toEqual([{ at: 3 }]);
  });

  test("types: a `customElement` is a `HostCode` a `Host` takes", () => {
    const code = customElement("x-dial", { set: () => undefined, events: { "dial-pick": () => ({ at: 1 }) } });
    expectTypeOf(code).toMatchTypeOf<HostCode<PointsValue, { at: number }>>();
    expectTypeOf<"dial">().not.toMatchTypeOf<Parameters<typeof customElement>[0]>();
    expect(true).toBe(true);
  });
});
