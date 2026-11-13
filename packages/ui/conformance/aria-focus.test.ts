// @vitest-environment happy-dom
// Spec: k.aria, Conformance "`focus` turning true focuses the element; `focus` true at the first render, and at resume, leaves focus where it was."
// Seed: 1337.
// Behavior extras: `tabIndex` is `0` or `-1`, never positive (type).
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import * as reactive from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { resume } from "@keel/runtime-dom/ops";
import * as aria from "@keel/ui/aria";
import { Part } from "@keel/ui/aria";
import fc from "fast-check";
import { afterEach, describe, expect, expectTypeOf, test } from "vitest";

const SEED = 1337;
type PartProps = Parameters<typeof Part>[0];

const hosts: HTMLElement[] = [];
afterEach(() => {
  for (const h of hosts.splice(0)) h.remove();
});
const host = (): HTMLElement => {
  const h = document.createElement("div");
  document.body.appendChild(h);
  hosts.push(h);
  return h;
};
const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const byId = (root: ParentNode, id: string): HTMLElement => {
  const el = root.querySelector(`[id="${id}"]`);
  if (!(el instanceof HTMLElement)) throw new Error(`no element ${id}`);
  return el;
};
/** A native input outside the widget that holds focus before the case runs. */
const outside = (): HTMLInputElement => {
  const input = document.createElement("input");
  input.setAttribute("aria-label", "outside");
  host().appendChild(input);
  input.focus();
  expect(document.activeElement).toBe(input);
  return input;
};

type Focusable = "button" | "checkbox" | "combobox";
const make = (kind: Focusable, focus: boolean | reactive.Signal<boolean>): Node => {
  switch (kind) {
    case "button":
      return Part({ id: "x", role: "button", controls: "p", focus, children: () => "Go" });
    case "checkbox":
      return Part({ id: "x", role: "checkbox", label: "Agree", checked: false, focus });
    case "combobox":
      return Part({ id: "x", role: "combobox", label: "Fruit", expanded: false, controls: "lb", focus });
  }
};
const kinds = fc.constantFrom<Focusable[]>("button", "checkbox", "combobox");

describe("k.aria: focus", () => {
  test.skip("`focus` turning true focuses the element", async () => {
    await fc.assert(
      fc.asyncProperty(kinds, async (kind) => {
        const prior = outside();
        const focus = reactive.signal(false);
        const root = host();
        const off = mount(() => make(kind, focus), root);
        await flush();
        expect(document.activeElement).toBe(prior);
        focus.set(true);
        await flush();
        expect(document.activeElement).toBe(byId(root, "x"));
        off();
      }),
      { seed: SEED, numRuns: 12 },
    );
  });

  test.skip("`focus` true at the first render leaves focus where it was", async () => {
    await fc.assert(
      fc.asyncProperty(kinds, async (kind) => {
        const prior = outside();
        const root = host();
        const off = mount(() => make(kind, true), root);
        await flush();
        expect(document.activeElement).toBe(prior);
        off();
      }),
      { seed: SEED, numRuns: 12 },
    );
  });

  test.skip("`focus` true at resume leaves focus where it was", async () => {
    const source = `
import { signal } from "@keel/reactive";
import { Part } from "@keel/ui/aria";
export default function FocusIsland(p: { label: string }) {
  const on = signal(true);
  return <Part id="fi.b" role="button" controls="fi.p" focus={on}>{p.label}</Part>;
}`;
    const compiled = compile([{ path: "FocusIsland.tsx", source }]);
    expect(compiled.diagnostics).toEqual([]);
    const fn = evaluate(compiled.outputs[0]?.code ?? "", { "@keel/reactive": reactive, "@keel/ui/aria": aria });
    if (typeof fn !== "function") throw new Error("fixture: no default export");
    const component = (props: Readonly<Record<string, unknown>>): Node => {
      const n: unknown = Reflect.apply(fn, undefined, [props]);
      if (!(n instanceof Node)) throw new Error("fixture: component did not return a Node");
      return n;
    };
    const props = { label: "Go" };
    const scratch = host();
    const dispose = mount(() => component(props), scratch);
    const root = scratch.firstElementChild;
    if (root === null) throw new Error("fixture: no island root");
    root.setAttribute("data-k-island", "FocusIsland");
    const html = root.outerHTML;
    dispose();
    const server = host();
    server.innerHTML = `${html}<script type="application/json" id="k-state">${JSON.stringify({ stores: {}, islands: { FocusIsland: props } })}</script>`;
    const prior = outside();
    const { warnings } = resume(server, { FocusIsland: component }, {});
    expect(warnings).toEqual([]);
    await flush();
    expect(document.activeElement).toBe(prior);
  });

  test.skip("`focus` turning from true to false and true again focuses the element again", async () => {
    const focus = reactive.signal(true);
    const root = host();
    const off = mount(() => make("button", focus), root);
    await flush();
    const prior = outside();
    focus.set(false);
    await flush();
    expect(document.activeElement).toBe(prior);
    focus.set(true);
    await flush();
    expect(document.activeElement).toBe(byId(root, "x"));
    off();
  });

  test.skip("`tabIndex` is `0` or `-1`, never positive (type)", () => {
    expectTypeOf<PartProps["tabIndex"]>().toEqualTypeOf<0 | -1 | undefined>();
    const root = host();
    const off = mount(() => Part({ id: "t", role: "generic", tabIndex: -1, children: () => "t" }), root);
    expect(byId(root, "t").getAttribute("tabindex")).toBe("-1");
    off();
  });
});
