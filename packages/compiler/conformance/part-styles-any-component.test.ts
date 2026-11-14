// Spec: k.aria, Part styles "`styles` on any component is `{ <part>: { <style props> } }`: the compiler collects each part's style props from that literal as a base element's (k.ui), and the component passes them to the part's `Part` or base element."
// Seed: 1337.
// Collection half. E1823 (unreadable `styles`) is reported by `keel check`: packages/check/conformance/rule-E1823.test.ts.
// Pending: not implemented yet.
import { compile } from "@keel/compiler";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
type Usage = { props: Readonly<Record<string, string>>; state?: string };

const app = (styles: string, name = "Page"): { path: string; source: string }[] => [
  {
    path: "Card.tsx",
    source: `import { Box } from '@keel/ui'
export function Card(props: { styles?: { body?: { p?: string } } }) { return <Box id="c" p={props.styles?.body?.p}>x</Box> }
`,
  },
  {
    path: `${name}.tsx`,
    source: `import { Card } from './Card.tsx'
export default function ${name}() { return <Card styles=${styles} /> }
`,
  },
];
const styled = (files: { path: string; source: string }[]): Usage[] => {
  const r = compile(files);
  expect(r.diagnostics).toEqual([]);
  return r.artifacts["styles.json"].usages;
};

describe("k.aria: part styles on any component", () => {
  test.skip("`styles={{ part: { p: '2' } }}` on an app's own component collects the `2` usage once", () => {
    const usages = styled(app("{{ body: { p: '2' } }}"));
    expect(usages.filter((u) => u.props.p === "2")).toHaveLength(1);
  });

  test.skip("`states` in a part of an app's own component are collected under their state", () => {
    const usages = styled(app("{{ body: { states: { hover: { bg: 'accent' } } } }}"));
    expect(usages.filter((u) => u.props.bg === "accent" && u.state === "hover")).toHaveLength(1);
  });

  test.skip("the same part styles on any number of usages give each rule once", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 4 }), (n) => {
        const files = [
          ...app("{{ body: { p: '2' } }}", "P0"),
          ...Array.from({ length: n - 1 }, (_, i) => app("{{ body: { p: '2' } }}", `P${i + 1}`)[1]).flatMap((f) =>
            f === undefined ? [] : [f],
          ),
        ];
        expect(styled(files).filter((u) => u.props.p === "2")).toHaveLength(1);
      }),
      { seed: SEED, numRuns: 8 },
    );
  });

  test.skip("a component forwarding its own `props.styles` collects nothing there and is not an error", () => {
    const r = compile([
      {
        path: "Wrap.tsx",
        source: `import { Card } from './Card.tsx'
export function Wrap(props: { styles?: { body?: { p?: string } } }) { return <Card styles={props.styles} /> }
`,
      },
      ...app("{{ body: { p: '2' } }}").slice(0, 1),
    ]);
    expect(r.diagnostics).toEqual([]);
    expect(r.artifacts["styles.json"].usages.filter((u) => u.props.p === "2")).toEqual([]);
  });
});
