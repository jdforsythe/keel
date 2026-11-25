// @vitest-environment happy-dom
// k.a11y Required props, "`label` on ... `Box as` `nav` or `aside` (`aria-label`; optional on other landmarks)"
// Spec: k.ui, clause "Two `Box as=\"nav\"` with distinct `label`s pass axe; a `nav` without one is E1802." (axe half: packages/testing/conformance)
// Seed 1337 (fast-check). Type-level assertions are checked by `tsc`; the runtime expects keep the file a test.
import { createCtx } from "@keel/ctx";
import { scope, signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { Box } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, expectTypeOf, test } from "vitest";
import { SEED, flush } from "./fixtures.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

type BoxP = Parameters<typeof Box>[0];
const LANDMARKS = ["nav", "aside", "section", "main", "header", "footer"] as const;
const make = (as: (typeof LANDMARKS)[number], label: string): Node => {
  switch (as) {
    case "nav":
      return Box({ id: "x", as: "nav", label, children: "b" });
    case "aside":
      return Box({ id: "x", as: "aside", label, children: "b" });
    case "section":
      return Box({ id: "x", as: "section", label, children: "b" });
    case "main":
      return Box({ id: "x", as: "main", label, children: "b" });
    case "header":
      return Box({ id: "x", as: "header", label, children: "b" });
    case "footer":
      return Box({ id: "x", as: "footer", label, children: "b" });
  }
};

const mounted = (make: () => Node): { host: HTMLElement; off: () => void } => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const off = mount(make, host, { ctx: simCtx });
  return { host, off };
};

describe("k.ui: Box label (RFC 0091 G)", () => {
  test("Box label is written as aria-label", () => {
    fc.assert(
      fc.property(fc.constantFrom(...LANDMARKS), fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,15}$/), (as, label) => {
        const { host, off } = mounted(() => make(as, label));
        expect(host.querySelector("#x")?.getAttribute("aria-label")).toBe(label);
        off();
        host.remove();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("a Box without label has no aria-label", () => {
    const { host, off } = mounted(() => Box({ id: "x", as: "section", children: "b" }));
    expect(host.querySelector("#x")?.hasAttribute("aria-label")).toBe(false);
    off();
    host.remove();
  });

  test("a getter label updates the aria-label attribute when it changes", async () => {
    const slot: ReturnType<typeof signal<string>>[] = [];
    const host = document.createElement("div");
    document.body.appendChild(host);
    let off = () => {};
    const sc = scope(() => {
      const sig = signal("Main menu");
      slot.push(sig);
      off = mount(
        () =>
          Box({
            id: "x",
            as: "nav",
            get label() {
              return sig.get();
            },
            children: "b",
          }),
        host,
        { ctx: simCtx },
      );
    });
    const sig = slot[0];
    if (sig === undefined) throw new Error("fixture: no signal");
    await flush();
    expect(host.querySelector("#x")?.getAttribute("aria-label")).toBe("Main menu");
    sig.set("Footer menu");
    await flush();
    expect(host.querySelector("#x")?.getAttribute("aria-label")).toBe("Footer menu");
    off();
    sc.dispose();
    host.remove();
  });

  test("E1802 Box as nav without label is a type error", () => {
    expectTypeOf<{ as: "nav" }>().not.toMatchTypeOf<BoxP>();
    expectTypeOf<{ as: "nav"; label: string }>().toMatchTypeOf<BoxP>();
    expect(true).toBe(true);
  });

  test("E1802 Box as aside without label is a type error", () => {
    expectTypeOf<{ as: "aside" }>().not.toMatchTypeOf<BoxP>();
    expectTypeOf<{ as: "aside"; label: string }>().toMatchTypeOf<BoxP>();
    expect(true).toBe(true);
  });

  test("Box label on div, ul, ol, li and article is refused", () => {
    expectTypeOf<{ as: "div"; label: string }>().not.toMatchTypeOf<BoxP>();
    expectTypeOf<{ as: "ul"; label: string }>().not.toMatchTypeOf<BoxP>();
    expectTypeOf<{ as: "ol"; label: string }>().not.toMatchTypeOf<BoxP>();
    expectTypeOf<{ as: "li"; label: string }>().not.toMatchTypeOf<BoxP>();
    expectTypeOf<{ as: "article"; label: string }>().not.toMatchTypeOf<BoxP>();
    expect(true).toBe(true);
  });

  test("Box label is accepted on section, main, header and footer, and those need no label", () => {
    expectTypeOf<{ as: "section"; label: string }>().toMatchTypeOf<BoxP>();
    expectTypeOf<{ as: "main"; label: string }>().toMatchTypeOf<BoxP>();
    expectTypeOf<{ as: "header"; label: string }>().toMatchTypeOf<BoxP>();
    expectTypeOf<{ as: "footer"; label: string }>().toMatchTypeOf<BoxP>();
    expectTypeOf<{ as: "section" }>().toMatchTypeOf<BoxP>();
    expectTypeOf<{ as: "main" }>().toMatchTypeOf<BoxP>();
    expectTypeOf<{ as: "header" }>().toMatchTypeOf<BoxP>();
    expectTypeOf<{ as: "footer" }>().toMatchTypeOf<BoxP>();
    expect(true).toBe(true);
  });
});
