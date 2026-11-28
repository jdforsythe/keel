// Spec: k.aria, clause "An app file importing `Part` from `@keel/ui/aria` reports no diagnostic, and its `styles` are collected as a stdlib component's."
// Seed: 1337. The collection half: an app file's `Part` style props and `states` reach `styles.json` as a base element's do.
import { compile } from "@keel/compiler";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
type Usage = { props: Readonly<Record<string, string>>; state?: string };
const usagesOf = (source: string): Usage[] => {
  const r = compile([{ path: "Cell.tsx", source }]);
  expect(r.diagnostics).toEqual([]);
  return r.artifacts["styles.json"].usages;
};
const cell = (attrs: string): string =>
  `import { Part } from '@keel/ui/aria'\nexport default function Cell() { return <Part id="c" role="gridcell" ${attrs}>1</Part> }\n`;

describe("k.aria: styles of an app file's `Part` are collected", () => {
  test("a style prop on an app file's `Part` is collected once", () => {
    expect(usagesOf(cell('p="2"')).filter((u) => u.props.p === "2")).toHaveLength(1);
  });

  test("`states` on an app file's `Part` are collected under their state, including `selected` and `highlighted`", () => {
    for (const state of ["selected", "highlighted", "expanded", "hover"]) {
      const u = usagesOf(cell(`states={{ ${state}: { bg: 'accent' } }}`));
      expect(u.filter((x) => x.props.bg === "accent" && x.state === state)).toHaveLength(1);
    }
  });

  test("property: any token value on an app `Part` is collected as the same usage a `Box` gets", () => {
    fc.assert(
      fc.property(fc.constantFrom("0", "1", "2", "3"), (p) => {
        const part = usagesOf(cell(`p="${p}"`)).filter((u) => u.props.p === p);
        const box = usagesOf(
          `import { Box } from '@keel/ui'\nexport default function Cell() { return <Box id="c" p="${p}">1</Box> }\n`,
        ).filter((u) => u.props.p === p);
        expect(part).toEqual(box);
      }),
      { seed: SEED, numRuns: 8 },
    );
  });
});
