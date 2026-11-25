// k.host-element, Rules "E1824 a `code` prop that is not `() => import("<relative path>").then((m) => m.<export>)`, or a `Host` without `input`."
// Spec: k.host-element, clause "A `Host` with neither `label` nor `labelledBy`, with both, or with `label=\" \"` is E1802 without types, and one with `label=\"Added\"` or `labelledBy=\"c.title\"` is not; `code={load}` is E1824."
// Seed: 1337.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED } from "./support.ts";

const HEAD = `import { s } from '@keel/schema'\nimport { Host } from '@keel/ui'\nconst In = s.object({ n: s.number() })\n`;
const page = (pre: string, attrs: string): string =>
  `${HEAD}${pre}export default function C() { return <Host id="c.h" role="img" label="L" ${attrs} /> }\n`;
const e1824 = (pre: string, attrs: string) =>
  check([{ path: "C.tsx", source: page(pre, attrs) }], { types: false }).diagnostics.filter((d) => d.code === "E1824");
const GOOD = `input={In} value={{ n: 1 }} code={() => import('./chart.ts').then((m) => m.chart)}`;

describe("k.host-element: E1824", () => {
  test("a `code` prop of the literal form `() => import('./chart.ts').then((m) => m.chart)` is not E1824", () => {
    expect(e1824("", GOOD)).toEqual([]);
  });

  test("`code={load}` is E1824", () => {
    expect(
      e1824(
        "const load = () => import('./chart.ts').then((m) => m.chart)\n",
        "input={In} value={{ n: 1 }} code={load}",
      ),
    ).toHaveLength(1);
  });

  test("E1824: a `code` that is not a literal dynamic import of a relative path is reported", () => {
    const bad = [
      "code={() => import(path).then((m) => m.chart)}",
      "code={() => import('chart').then((m) => m.chart)}",
      "code={() => import('./chart.ts')}",
      "code={() => import('./chart.ts').then((m) => m)}",
      "code={() => import('./chart.ts').then((m) => m.chart.draw)}",
      "code={() => hostCode({ mount: () => ({}) })}",
    ];
    for (const code of bad) {
      expect(e1824("const path = './chart.ts'\n", `input={In} value={{ n: 1 }} ${code}`)).toHaveLength(1);
    }
  });

  test("E1824: a `Host` without `input` is reported", () => {
    expect(e1824("", "value={{ n: 1 }} code={() => import('./chart.ts').then((m) => m.chart)}")).toHaveLength(1);
  });

  test("property: any relative path and export name in the literal form is not E1824", () => {
    const name = fc.stringMatching(/^[a-z][A-Za-z0-9]{0,8}$/);
    fc.assert(
      fc.property(name, name, (file, exp) => {
        expect(
          e1824("", `input={In} value={{ n: 1 }} code={() => import('./${file}.ts').then((m) => m.${exp})}`),
        ).toEqual([]);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});
