// @vitest-environment happy-dom
// Spec: k.ui, clause "Two `Box as=\"nav\"` with distinct `label`s pass axe; a `nav` without one is E1802."
// RFC 0091 G, "Two landmarks of one role with equal labels stay a test-time E1703 (axe `landmark-unique`)."
// Seed: 1337 (fast-check). The harness `render` runs axe after the first render and throws E1703 on a violation.
// Untestable here: "a `nav` without a label is E1802" is a type error that `keel check` maps; asserted by tsc in packages/ui/conformance/box-label-0091.test.ts.
// Undefined by the spec: a lone unlabeled landmark; label comparison (case, whitespace) for uniqueness is left to axe.
import { render } from "@keel/testing";
import { Box } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, codeOf, messageOf, simCtx, thrown } from "./fixtures.ts";
import { page } from "./ui-fixtures.ts";

const navs = (labels: readonly string[]): Node =>
  Box({
    id: "root",
    children: labels.map((label, i) => Box({ id: `n${i}`, as: "nav", label, children: "links" })),
  });

const label = fc.stringMatching(/^[a-z]{1,8}$/);

describe("k.ui: two Box as=nav with distinct labels pass axe", () => {
  it('Two `Box as="nav"` with distinct `label`s pass axe', () => {
    const t = render(
      page(() => navs(["Primary", "Footer"])),
      { props: {}, ctx: simCtx() },
    );
    expect(t.find("n0").id).toBe("n0");
    expect(t.find("n1").id).toBe("n1");
    t.dispose();
  });

  it("N navs with pairwise-distinct labels pass axe (property)", () => {
    fc.assert(
      fc.property(fc.uniqueArray(label, { minLength: 2, maxLength: 5 }), (labels) => {
        const t = render(
          page(() => navs(labels)),
          { props: {}, ctx: simCtx() },
        );
        t.dispose();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it('two `Box as="nav"` with equal labels are E1703 landmark-unique', async () => {
    const e = await thrown(() =>
      render(
        page(() => navs(["Menu", "Menu"])),
        { props: {}, ctx: simCtx() },
      ),
    );
    expect(codeOf(e)).toBe("E1703");
    expect(messageOf(e)).toContain("landmark-unique");
  });

  it("any duplicated label among N navs is E1703 landmark-unique (property)", async () => {
    const gen = fc
      .tuple(fc.uniqueArray(label, { minLength: 1, maxLength: 4 }), fc.nat())
      .map(([labels, k]) => [...labels, labels[k % labels.length] ?? "x"]);
    const cases = fc.sample(gen, { seed: SEED, numRuns: 15 });
    for (const labels of cases) {
      const e = await thrown(() =>
        render(
          page(() => navs(labels)),
          { props: {}, ctx: simCtx() },
        ),
      );
      expect(codeOf(e)).toBe("E1703");
      expect(messageOf(e)).toContain("landmark-unique");
    }
  });
});
