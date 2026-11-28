// @vitest-environment happy-dom
// Spec: k.a11y, clause "An unlabeled `input` made with the runtime's `element` fails its render with E1703 naming rule `label` and the element id."
// Seed: 1337.
import { element } from "@keel/runtime-dom/ops";
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, codeOf, messageOf, simCtx, thrown } from "./fixtures.ts";
import { page } from "./ui-fixtures.ts";

const input = (id: string, label?: string) =>
  page(() =>
    element("input", (el) => {
      el.id = id;
      if (label !== undefined) el.setAttribute("aria-label", label);
    }),
  );

describe("k.a11y: axe-core in the harness (E1703)", () => {
  it("An unlabeled `input` made with the runtime's `element` fails its render with E1703 naming rule `label` and the element id", async () => {
    const e = await thrown(() => render(input("axe.name"), { props: {}, ctx: simCtx() }));
    expect(codeOf(e)).toBe("E1703");
    expect(messageOf(e)).toContain("label");
    expect(messageOf(e)).toContain("axe.name");
  });

  it("any element id is named in the violation (property)", async () => {
    const ids = fc.stringMatching(/^[a-z][a-z0-9]{0,8}(\.[a-z][a-z0-9]{0,8}){0,2}$/);
    const cases = fc.sample(ids, { seed: SEED, numRuns: 15 });
    for (const id of cases) {
      const e = await thrown(() => render(input(id), { props: {}, ctx: simCtx() }));
      expect(codeOf(e)).toBe("E1703");
      expect(messageOf(e)).toContain("label");
      expect(messageOf(e)).toContain(id);
    }
  });

  it("the same input with an accessible name renders without E1703", () => {
    const t = render(input("axe.named", "Name"), { props: {}, ctx: simCtx() });
    expect(t.find("axe.named").id).toBe("axe.named");
    t.dispose();
  });
});
