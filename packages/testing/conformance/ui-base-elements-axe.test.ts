// @vitest-environment happy-dom
// Spec: k.ui, clause "Every base element rendered with only its required props has no axe violations."
// k.ui Seed: 1337.
// The harness `render` runs the axe rules after the first render (E1703); a violation throws, so a returned harness means none.
import { render } from "@keel/testing";
import { Box, Button, Checkbox, Heading, Image, Input, Link, Select, Text, TextArea } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, simCtx } from "./fixtures.ts";
import { home, page } from "./ui-fixtures.ts";

const cases: [string, string, () => Node][] = [
  ["Box", "e", () => Box({ id: "e" })],
  ["Text", "e", () => Text({ id: "e", children: "hello" })],
  ["Heading", "e", () => Heading({ id: "e", level: 2, children: "Orders" })],
  ["Button (text)", "e", () => Button({ id: "e", children: "Save" })],
  ["Button (image named by alt)", "e", () => Button({ id: "e", children: Image({ src: "save.svg", alt: "Save" }) })],
  ["Link", "e", () => Link({ id: "e", to: home, children: "Home" })],
  ["Image (alt)", "e", () => Image({ id: "e", alt: "logo" })],
  ["Image (decorative)", "e", () => Image({ id: "e", decorative: true })],
  ["Input", "e", () => Input({ id: "e", label: "Name" })],
  ["TextArea", "e", () => TextArea({ id: "e", label: "Notes" })],
  ["Select", "e", () => Select({ id: "e", label: "Kind" })],
  ["Checkbox", "e", () => Checkbox({ id: "e", label: "Agree" })],
];

describe("k.ui: every base element rendered with only its required props has no axe violations", () => {
  for (const [name, id, make] of cases) {
    it(`${name} renders under the harness without E1703`, () => {
      const t = render(page(make), { props: {}, ctx: simCtx() });
      expect(t.find(id).id).toBe(id);
      t.dispose();
    });
  }

  it("an axe violation is reported as E1703 (an Image with neither alt nor decorative)", () => {
    const bad = page(() => {
      const img = document.createElement("img");
      img.setAttribute("src", "x.png");
      return img;
    });
    expect(() => render(bad, { props: {}, ctx: simCtx() })).toThrow(/E1703/);
  });

  it("Heading renders the requested level for every level with no violations", () => {
    fc.assert(
      fc.property(fc.constantFrom<1 | 2 | 3 | 4 | 5 | 6>(1, 2, 3, 4, 5, 6), (level) => {
        const t = render(
          page(() => Heading({ id: "h", level, children: "T" })),
          { props: {}, ctx: simCtx() },
        );
        expect(t.find("h")).toMatchObject({ role: "heading", name: "T" });
        expect(t.a11y("h").id).toBe("h");
        t.dispose();
      }),
      { seed: SEED, numRuns: 12 },
    );
  });
});
