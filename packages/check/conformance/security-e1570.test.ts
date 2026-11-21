// Spec: k.security, Conformance "`Image src="https://cdn.example/a.png"` and `action="https://x.example/"` are each E1570; `src="logo.png"` is not."
// Spec: k.security, Rules "E1570 a literal absolute `http(s)` URL in `src`, `poster`, `data`, `srcset`, `action`, `formaction` or `Image src`: the policy blocks an undeclared origin (k.origins; fix: none)"
// Seed: 1337.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, one } from "./support.ts";

const IMAGE = (src: string): string =>
  `import { Image } from '@keel/ui'\nexport default function C() { return <Image src=${JSON.stringify(src)} alt="x" /> }\n`;
const FORM = (action: string): string =>
  `import { Form } from '@keel/forms'\nexport default function C() { return <Form method="POST" action=${JSON.stringify(action)} /> }\n`;

const diags = (source: string) => check(one(source), { types: false }).diagnostics.filter((d) => d.code === "E1570");

const host = fc.stringMatching(/^[a-z]{3,10}$/);
const scheme = fc.constantFrom("http", "https");

describe("k.security: E1570", () => {
  test('E1570: `Image src="https://cdn.example/a.png"` is reported', () => {
    expect(diags(IMAGE("https://cdn.example/a.png"))).toHaveLength(1);
  });

  test('E1570: `action="https://x.example/"` is reported', () => {
    expect(diags(FORM("https://x.example/"))).toHaveLength(1);
  });

  test('E1570: `src="logo.png"` is not reported', () => {
    expect(diags(IMAGE("logo.png"))).toEqual([]);
  });

  test("E1570: any literal absolute http(s) URL in `Image src` is reported, a relative path is not", () => {
    fc.assert(
      fc.property(scheme, host, host, (sch, h, file) => {
        expect(diags(IMAGE(`${sch}://${h}.example/${file}.png`))).toHaveLength(1);
        expect(diags(IMAGE(`/${file}.png`))).toEqual([]);
        expect(diags(IMAGE(`${file}.png`))).toEqual([]);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  test("E1570: any literal absolute http(s) URL in `action` is reported", () => {
    fc.assert(
      fc.property(scheme, host, (sch, h) => {
        expect(diags(FORM(`${sch}://${h}.example/`))).toHaveLength(1);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  test("E1570: carries no fix (fix: none)", () => {
    for (const d of [...diags(IMAGE("https://cdn.example/a.png")), ...diags(FORM("https://x.example/"))]) {
      expect(d.fix).toBeUndefined();
    }
  });
});
