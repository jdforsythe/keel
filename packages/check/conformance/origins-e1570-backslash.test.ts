// rfc:0160 conformance: `Image src` beginning `/\evil.example/x`, and beginning two backslashes then `evil.example/x`, are each E1570.
// k.origins, Rules "E1570 also reports a literal `Frame src` that is not absolute, and reads `\` as `/` (`/\host`)"
// Seed 1337 (fc.assert below).
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, decl, single, withCode } from "./origins-support.ts";

const IMAGE = (src: string): string =>
  `import { Image } from '@keel/ui'\nexport default function C() { return <Image src=${JSON.stringify(src)} alt="x" /> }\n`;
const e1570 = (origins: string | undefined, src: string) =>
  withCode(single(origins, [{ path: "modules/a/C.tsx", source: IMAGE(src) }]), "E1570");

describe("rfc:0160 conformance: E1570 reads a backslash as a slash", () => {
  test('rfc:0160 conformance: `Image src="/\\evil.example/x"` is E1570', () => {
    expect(e1570(undefined, "/\\evil.example/x")).toHaveLength(1);
  });
  test('rfc:0160 conformance: `Image src="\\\\evil.example/x"` is E1570', () => {
    expect(e1570(undefined, "\\\\evil.example/x")).toHaveLength(1);
  });
  test("rfc:0160 conformance: either is E1570 though `https://evil.example` is declared under `img`", () => {
    const origins = decl("img", "https://evil.example");
    expect(e1570(origins, "/\\evil.example/x")).toHaveLength(1);
    expect(e1570(origins, "\\\\evil.example/x")).toHaveLength(1);
  });
  test("rfc:0160 conformance: a `src` whose first two characters are slashes or backslashes, one at least a backslash, is E1570", () => {
    fc.assert(
      fc.property(fc.constantFrom("/\\", "\\/", "\\\\"), fc.stringMatching(/^[a-z]{3,10}$/), (lead, h) => {
        expect(e1570(undefined, `${lead}${h}.example/x`)).toHaveLength(1);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});
