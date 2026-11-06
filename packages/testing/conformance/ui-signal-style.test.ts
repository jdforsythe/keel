// @vitest-environment happy-dom
// Spec: k.ui Conformance, "A signal bound to a style prop changes only the element's class list; no element ever has a `style` attribute". Seed: 1337.
// A Button driven by the harness `fire` sets the signal; `a11y()` and `find` show nothing but the class changed.
import { signal } from "@keel/reactive";
import { render } from "@keel/testing";
import { Box, Button, Checkbox, Heading, Image, Input, Link, Select, Text, TextArea } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, simCtx } from "./fixtures.ts";
import { home, page } from "./ui-fixtures.ts";

const VALUES = ["0", "1", "2", "3"] as const;

/** The only DOM read: the class list and attributes of the bound element (the harness exposes neither). */
const dom = (id: string): Element => {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`no element ${id}`);
  return el;
};
const attrsExceptClass = (e: Element): [string, string][] =>
  Array.from(e.attributes)
    .filter((a) => a.name !== "class")
    .map((a): [string, string] => [a.name, a.value]);

describe("k.ui: a signal bound to a style prop changes only the element's class list", () => {
  it("firing a click that sets the signal changes the class list and nothing else", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.constantFrom(...VALUES), { minLength: 1, maxLength: 6 }), async (seq) => {
        let current = "0";
        let i = 0;
        const C = page(() => {
          // Signals are created in the render's scope (E1203).
          const p = signal<string>("0");
          return Box({
            children: [
              Box({ id: "styled", p, children: "x" }),
              Button({
                id: "next",
                label: "next",
                onClick: () => {
                  current = seq[i++] ?? "0";
                  p.set(current);
                },
              }),
            ],
          });
        });
        const t = render(C, { props: {}, ctx: simCtx() });
        const el = dom("styled");
        const tree = t.a11y();
        const attrs = attrsExceptClass(el);
        let prev = "0";
        for (const v of seq) {
          const before = el.className;
          await t.fire("next", { type: "click" });
          expect(current).toBe(v);
          expect(dom("styled")).toBe(el);
          expect(attrsExceptClass(el)).toEqual(attrs);
          expect(el.hasAttribute("style")).toBe(false);
          expect(t.a11y()).toEqual(tree);
          expect(t.find("styled").text).toBe("x");
          if (v === prev) expect(el.className).toBe(before);
          else expect(el.className).not.toBe(before);
          prev = v;
        }
        t.dispose();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("changing the bound value changes the class list", async () => {
    const C = page(() => {
      const p = signal<string>("1");
      return Box({
        children: [Box({ id: "styled", p }), Button({ id: "set", label: "set", onClick: () => p.set("3") })],
      });
    });
    const t = render(C, { props: {}, ctx: simCtx() });
    const before = dom("styled").className;
    await t.fire("set", { type: "click" });
    expect(dom("styled").className).not.toBe(before);
    t.dispose();
  });
});

describe("k.ui: no element ever has a style attribute", () => {
  it("every base element, with style props and states, renders without a style attribute", () => {
    const C = page(() =>
      Box({
        id: "root",
        p: "2",
        bg: "bg",
        states: { hover: { bg: "accent" } },
        children: [
          Text({ fg: "fg", children: "t" }),
          Heading({ level: 1, children: "h" }),
          Button({ children: "b" }),
          Link({ to: home, children: "l" }),
          Image({ alt: "i", w: "3" }),
          Input({ label: "a" }),
          TextArea({ label: "b" }),
          Select({ label: "c" }),
          Checkbox({ label: "d" }),
        ],
      }),
    );
    const t = render(C, { props: {}, ctx: simCtx() });
    expect(dom("root").querySelectorAll("[style]")).toHaveLength(0);
    expect(dom("root").hasAttribute("style")).toBe(false);
    t.dispose();
  });
});
