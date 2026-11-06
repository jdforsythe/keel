// @vitest-environment happy-dom
// Spec: k.ui Conformance 4. Structural stand-in for axe; axe proper arrives with @keel/testing.
import { mount } from "@keel/runtime-dom";
import { Box, Button, Checkbox, Heading, Image, Input, Link, Select, Text, TextArea } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, a11yViolations, home } from "./fixtures.ts";

const cases: [string, () => Node][] = [
  ["Box", () => Box({})],
  ["Text", () => Text({ children: "hello" })],
  ["Heading", () => Heading({ level: 2, children: "Orders" })],
  ["Button", () => Button({ children: "Save" })],
  ["Link", () => Link({ to: home, children: "Home" })],
  ["Image", () => Image({ alt: "logo" })],
  ["Image decorative", () => Image({ decorative: true })],
  ["Input", () => Input({ label: "Name" })],
  ["TextArea", () => TextArea({ label: "Notes" })],
  ["Select", () => Select({ label: "Kind" })],
  ["Checkbox", () => Checkbox({ label: "Agree" })],
];

describe("k.ui: Every base element rendered with only its required props has no axe violations", () => {
  for (const [name, make] of cases) {
    it(`${name} rendered with only its required props has no axe violations`, () => {
      const el = document.createElement("div");
      document.body.append(el);
      const dispose = mount(make, el);
      expect(a11yViolations(el)).toEqual([]);
      dispose();
      el.remove();
    });
  }

  it("Heading renders the requested level for every level", () => {
    fc.assert(
      fc.property(fc.constantFrom<1 | 2 | 3 | 4 | 5 | 6>(1, 2, 3, 4, 5, 6), (level) => {
        const el = document.createElement("div");
        const dispose = mount(() => Heading({ level, children: "T" }), el);
        expect(a11yViolations(el)).toEqual([]);
        expect(el.querySelector(`h${level}, [aria-level="${level}"]`)).not.toBeNull();
        dispose();
      }),
      { seed: SEED, numRuns: 12 },
    );
  });
});
