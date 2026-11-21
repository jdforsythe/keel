// @vitest-environment happy-dom
// Spec: k.host-code, Conformance "`customElement('x-dial', { set })` creates one `x-dial` child, calls `set` at mount and on each update, and removes the child at dispose."
// Spec: k.host-code, Conformance "With `events: { 'dial-pick': (ev) => ({ at: 1 }) }`, a `dial-pick` event dispatched on the `x-dial` child calls `onEvent` once with `{ at: 1 }`; the same event dispatched on the `div`, or on the child after dispose, calls nothing."
// Spec: k.host-code, customElement "Each `events` key is a DOM event type the custom element dispatches (`'change'`, `'dial-pick'`), and its entry `(ev: Event) => E` maps the event to what `emit` carries: `mount` listens for that type on the child, not on the `div`, with `out.signal`, and passes each result to `out.emit`, so the `Host`'s `events` schema parses it as any `emit`."
// Seed: 1337.
import { If, mount } from "@keel/runtime-dom";
import { Host, customElement } from "@keel/ui";
import fc from "fast-check";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Pick, Points, type PointsValue, SEED, flush, frames, simCtx } from "./host-support.ts";
import { cleanup, host, signal } from "./host-dom.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("k.host-element: customElement", () => {
  test("`customElement('x-dial', { set })` creates one `x-dial` child, calls `set` at mount and on each update, and removes the child at dispose", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.integer(), { minLength: 1, maxLength: 4 }), async (writes) => {
        const f = frames();
        const sets: PointsValue[] = [];
        const code = customElement("x-dial", {
          set: (_el: HTMLElement, value: PointsValue) => {
            sets.push(value);
          },
        });
        const sig = signal<PointsValue>({ points: [] });
        const on = signal(true);
        const root = host();
        mount(
          () =>
            If({
              get when() {
                return on.get();
              },
              children: () =>
                Host({
                  id: "h.dial",
                  role: "img",
                  label: "Dial",
                  input: Points,
                  value: sig,
                  code: () => Promise.resolve(code),
                }),
            }),
          root,
          { ctx: simCtx() },
        );
        await flush();
        f.step();
        const node = root.querySelector("[data-k-host]");
        expect(node?.children).toHaveLength(1);
        expect(node?.firstElementChild?.tagName.toLowerCase()).toBe("x-dial");
        expect(sets).toHaveLength(1);
        for (const n of writes) {
          sig.set({ points: [n] });
          await flush();
          f.step();
        }
        expect(sets).toHaveLength(1 + writes.length);
        on.set(false);
        await flush();
        expect(root.querySelector("x-dial")).toBeNull();
        vi.unstubAllGlobals();
      }),
      { seed: SEED, numRuns: 8 },
    );
  });

  const withDial = async (events: { "dial-pick": (ev: Event) => { at: number } }) => {
    const f = frames();
    const got: unknown[] = [];
    const on = signal(true);
    const code = customElement("x-dial", { set: () => undefined, events });
    const root = host();
    mount(
      () =>
        If({
          get when() {
            return on.get();
          },
          children: () =>
            Host({
              id: "h.dial",
              role: "img",
              label: "Dial",
              input: Points,
              value: { points: [] },
              events: Pick,
              onEvent: (e: { at: number }) => got.push(e),
              code: () => Promise.resolve(code),
            }),
        }),
      root,
      { ctx: simCtx() },
    );
    await flush();
    f.step();
    const node = root.querySelector("[data-k-host]");
    const child = root.querySelector("x-dial");
    if (!(node instanceof HTMLElement) || !(child instanceof HTMLElement)) throw new Error("fixture: no host element");
    return {
      got,
      node,
      child,
      off: async () => {
        on.set(false);
        await flush();
      },
    };
  };

  test("with `events: { 'dial-pick': (ev) => ({ at: 1 }) }`, a `dial-pick` event dispatched on the `x-dial` child calls `onEvent` once with `{ at: 1 }`", async () => {
    const { got, child } = await withDial({ "dial-pick": () => ({ at: 1 }) });
    child.dispatchEvent(new Event("dial-pick"));
    await flush();
    expect(got).toEqual([{ at: 1 }]);
  });

  test("the same event dispatched on the `div` calls nothing", async () => {
    const { got, node } = await withDial({ "dial-pick": () => ({ at: 1 }) });
    node.dispatchEvent(new Event("dial-pick"));
    await flush();
    expect(got).toEqual([]);
  });

  test("the same event dispatched on the child after dispose calls nothing", async () => {
    const { got, child, off } = await withDial({ "dial-pick": () => ({ at: 1 }) });
    await off();
    child.dispatchEvent(new Event("dial-pick"));
    await flush();
    expect(got).toEqual([]);
  });

  test("property: each result of the entry goes to `emit` and reaches `onEvent` parsed, once per dispatched event", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.integer({ min: -100, max: 100 }), { minLength: 1, maxLength: 5 }), async (ats) => {
        let i = 0;
        const { got, child } = await withDial({ "dial-pick": () => ({ at: ats[i++] ?? 0 }) });
        for (let k = 0; k < ats.length; k++) child.dispatchEvent(new Event("dial-pick"));
        await flush();
        expect(got).toEqual(ats.map((at) => ({ at })));
        vi.unstubAllGlobals();
      }),
      { seed: SEED, numRuns: 8 },
    );
  });

  test("an entry result that fails the `Host`'s `events` schema is not passed to `onEvent`", async () => {
    const { got, child } = await withDial({ "dial-pick": () => JSON.parse('{"at":"x"}') });
    child.dispatchEvent(new Event("dial-pick"));
    await flush();
    expect(got).toEqual([]);
  });
});
