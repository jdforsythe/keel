// @vitest-environment happy-dom
// Spec: k.ui Conformance 5. Property seed: 1337.
// Assumed: a signal passed as a style prop value is read reactively by the element.
import { signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { Box, Button, Checkbox, Heading, Image, Input, Link, Select, Text, TextArea } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, flush } from "./fixtures.ts";

const attrsExceptClass = (e: Element): [string, string][] =>
  Array.from(e.attributes)
    .filter((a) => a.name !== "class")
    .map((a): [string, string] => [a.name, a.value]);

describe("k.ui: A signal bound to a style prop changes only the element's class list; no element ever has a style attribute", () => {
  it("A signal bound to a style prop changes only the element's class list", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.constantFrom("0", "1", "2", "3"), { minLength: 1, maxLength: 6 }), async (seq) => {
        const s = signal<string>("0");
        const host = document.createElement("div");
        const dispose = mount(() => Box({ p: s, children: "x" }), host);
        const box = host.firstElementChild;
        if (box === null) throw new Error("no element");
        const attrs = attrsExceptClass(box);
        const tag = box.tagName;
        for (const v of seq) {
          s.set(v);
          await flush();
          expect(host.firstElementChild).toBe(box);
          expect(box.tagName).toBe(tag);
          expect(attrsExceptClass(box)).toEqual(attrs);
          expect(box.hasAttribute("style")).toBe(false);
        }
        dispose();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("changing the bound value changes the class list", async () => {
    const s = signal<string>("1");
    const host = document.createElement("div");
    const dispose = mount(() => Box({ p: s }), host);
    const box = host.firstElementChild;
    if (box === null) throw new Error("no element");
    const before = box.className;
    s.set("3");
    await flush();
    expect(box.className).not.toBe(before);
    dispose();
  });

  it("no element ever has a style attribute", () => {
    const host = document.createElement("div");
    const dispose = mount(
      () =>
        Box({
          p: "2",
          bg: "bg",
          hover: { bg: "accent" },
          children: [
            Text({ fg: "fg", children: "t" }),
            Heading({ level: 1, children: "h" }),
            Button({ children: "b" }),
            Link({ to: "/", children: "l" }),
            Image({ alt: "i", w: "3" }),
            Input({ label: "a" }),
            TextArea({ label: "b" }),
            Select({ label: "c" }),
            Checkbox({ label: "d" }),
          ],
        }),
      host,
    );
    expect(host.querySelectorAll("[style]")).toHaveLength(0);
    dispose();
  });
});
