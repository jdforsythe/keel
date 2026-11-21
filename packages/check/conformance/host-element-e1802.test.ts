// Spec: k.host-element, Conformance "A `Host` with neither `label` nor `labelledBy`, with both, or with `label=" "` is E1802 without types, and one with `label="Added"` or `labelledBy="c.title"` is not; `code={load}` is E1824."
// Spec: k.host-element, Text alternative "Exactly one of `label` (`aria-label`) and `labelledBy` (`aria-labelledby`, an element id). E1802, without types: a `Host` with neither, with both, or with a literal `label` holding no visible character (blank as k.a11y reads it). A computed `label` and any `labelledBy` are not checked statically, and with a spread only the types check presence; `a11y()` checks the name at render."
// Seed: 1337. `keel check` without types, as the k.a11y E1802 clauses.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED } from "./support.ts";

const HEAD = `import { s } from '@keel/schema'\nimport { Host } from '@keel/ui'\nconst In = s.object({ n: s.number() })\n`;
const CODE = `code={() => import('./chart.ts').then((m) => m.chart)}`;
const host = (attrs: string): string =>
  `${HEAD}export default function C() { return <Host id="c.h" role="img" ${attrs} input={In} value={{ n: 1 }} ${CODE} /> }\n`;
const e1802 = (attrs: string) =>
  check([{ path: "C.tsx", source: host(attrs) }], { types: false }).diagnostics.filter((d) => d.code === "E1802");

describe("k.host-element: E1802", () => {
  test("a `Host` with neither `label` nor `labelledBy` is E1802", () => {
    expect(e1802("")).toHaveLength(1);
  });

  test("E1802: a `Host` with `label` or with `labelledBy` is not reported", () => {
    expect(e1802('label="Added per day"')).toEqual([]);
    expect(e1802('labelledBy="c.title"')).toEqual([]);
  });

  test("E1802: a blank `label` is reported, however it is blank", () => {
    for (const blank of ['label=""', 'label=" "', 'label={"\\u{200B}"}', 'label="&zwnj;"']) {
      expect(e1802(blank)).toHaveLength(1);
    }
  });

  test("E1802: a `Host` with both `label` and `labelledBy` is reported (exactly one)", () => {
    expect(e1802('label="L" labelledBy="c.title"')).toHaveLength(1);
  });

  test("a computed `label` is not reported", () => {
    expect(e1802("label={name}")).toEqual([]);
    expect(e1802("label={`${name}`}")).toEqual([]);
  });

  test("any `labelledBy` is not reported", () => {
    for (const v of ['labelledBy="c.title"', 'labelledBy=""', "labelledBy={titleId}"]) expect(e1802(v)).toEqual([]);
  });

  test("with a spread, presence is left to the types: a `Host` with `{...rest}` and no `label` is not reported", () => {
    expect(e1802("{...rest}")).toEqual([]);
  });

  test("property: any non-blank ASCII `label` is not reported", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,15}$/), (label) => {
        expect(e1802(`label="${label}"`)).toEqual([]);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});
