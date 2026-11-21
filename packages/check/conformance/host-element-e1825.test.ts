// Spec: k.host-code, Rules "E1825 a `.css` import outside a host element code file."
// Spec: k.host-code, Conformance "`import 'x/a.css'` in a component file is E1825 and in a host element code file is not."
// Spec: k.host-code, Styles and policy "A host element code file (one a `code` prop imports) may import a same-origin `.css` file of a package, emitted as its own stylesheet."
// Seed: 1337.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED } from "./support.ts";

const COMPONENT = `import { s } from '@keel/schema'
import { Host } from '@keel/ui'
const In = s.object({ n: s.number() })
export default function C() { return <Host id="c.h" role="img" label="L" input={In} value={{ n: 1 }} code={() => import('./chart.ts').then((m) => m.chart)} /> }
`;
const e1825 = (files: { path: string; source: string }[]) =>
  check(files, { types: false }).diagnostics.filter((d) => d.code === "E1825");
const css = (spec: string): string => `import '${spec}'\nexport const chart = undefined\n`;

describe("k.host-element: E1825", () => {
  test("`import 'x/a.css'` in a component file is E1825", () => {
    const source = `import 'x/a.css'\n${COMPONENT}`;
    expect(e1825([{ path: "C.tsx", source }])).toHaveLength(1);
  });

  test("`import 'x/a.css'` in a host element code file is not", () => {
    expect(
      e1825([
        { path: "C.tsx", source: COMPONENT },
        { path: "chart.ts", source: css("x/a.css") },
      ]),
    ).toEqual([]);
  });

  test("a `.css` import in a `.ts` file no `code` prop imports is E1825", () => {
    expect(
      e1825([
        { path: "C.tsx", source: COMPONENT },
        { path: "other.ts", source: css("x/a.css") },
      ]),
    ).toHaveLength(1);
  });

  test("a `.css` import in the code file of another file's `Host` is not E1825 there, and is in a file nothing imports as code", () => {
    const files = [
      { path: "C.tsx", source: COMPONENT },
      { path: "chart.ts", source: css("x/a.css") },
      { path: "D.tsx", source: `import 'x/b.css'\nexport default function D() { return null }\n` },
    ];
    const hits = e1825(files);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.path).toBe("D.tsx");
  });

  test("property: a `.css` import with any package path is E1825 in a component file and not in the host element code file", () => {
    const seg = fc.stringMatching(/^[a-z]{2,8}$/);
    fc.assert(
      fc.property(seg, seg, (pkg, file) => {
        const spec = `${pkg}/${file}.css`;
        expect(e1825([{ path: "C.tsx", source: `import '${spec}'\n${COMPONENT}` }])).toHaveLength(1);
        expect(
          e1825([
            { path: "C.tsx", source: COMPONENT },
            { path: "chart.ts", source: css(spec) },
          ]),
        ).toEqual([]);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});
