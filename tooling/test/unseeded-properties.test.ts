import { describe, expect, it } from "vitest";
import { unseededProperties } from "../unseeded-properties.mjs";

const FC = `import fc from "fast-check";\n`;
const lines = (body: string, head = FC): number[] =>
  unseededProperties(head + body, "a.test.ts").map((d: { line: number }) => d.line);

describe("unseededProperties (S0015)", () => {
  it("finds assert, check, sample and statistics with no seed, at the call", () => {
    const body = [
      "fc.assert(fc.property(a, f));",
      "fc.assert(fc.property(a, f), { numRuns: 50 });",
      "fc.check(p, {});",
      "fc.sample(a, 10);",
      "fc.statistics(a, f, { numRuns: 5 });",
      "fc.assert(p, opts);",
    ].join("\n");
    expect(lines(body)).toEqual([2, 3, 4, 5, 6, 7]);
    const [d] = unseededProperties(`${FC}  fc.assert(p);`, "a.test.ts");
    expect(d).toMatchObject({ line: 2, col: 3 });
    expect(d?.message).toContain("no seed");
  });

  it("leaves a call given a seed, and a file whose top level seeds configureGlobal; a spread of nothing known is unseeded", () => {
    expect(
      lines("fc.assert(p, { seed: 1337 });\nfc.sample(a, { seed: 1, numRuns: 3 });\nfc.assert(p, { ...OPTS });"),
    ).toEqual([4]);
    expect(lines("fc.configureGlobal({ seed: 1337, numRuns: 100 });\nfc.assert(p);")).toEqual([]);
    expect(lines("fc.configureGlobal({ numRuns: 100 });\nfc.assert(p);")).toEqual([3]);
  });

  it("follows namespace and by-name imports, and nothing that is not fast-check's", () => {
    expect(lines("fc.assert(p);", `import * as fc from "fast-check";\n`)).toEqual([2]);
    expect(lines("check(p);\nassert(p);", `import { assert as check } from "fast-check";\n`)).toEqual([2]);
    expect(lines("fc.assert(p);", `import fc from "./mine.ts";\n`)).toEqual([]);
    expect(lines("other.assert(p);\nfc.property(a, f);")).toEqual([]);
  });

  it("resolves an options name: a const of the file, every const of that name, or a relative import's export const", () => {
    expect(
      lines("const run = { seed: 1, numRuns: 9 };\nfc.assert(p, run);\nfc.assert(p, { ...run, numRuns: 3 });"),
    ).toEqual([]);
    expect(lines("const run = { numRuns: 9 };\nfc.assert(p, run);\nfc.assert(p, { ...run });")).toEqual([3, 4]);
    expect(
      lines("it(() => { const o = { seed: 1 }; fc.assert(p, o); });\nit(() => { const o = {}; fc.assert(p, o); });"),
    ).toEqual([2, 3]);
    expect(lines("function f() { const o = { seed: 1 }; fc.assert(p, o); }")).toEqual([]);
    const read = (_from: string, spec: string) =>
      spec === "./kit.ts"
        ? { file: "kit.ts", source: "export const opts = { seed: 1337 };\nexport const bare = {};" }
        : undefined;
    const head = `${FC}import { opts, bare } from "./kit.ts";\nimport { far } from "./gone.ts";\n`;
    const got = unseededProperties(
      `${head}fc.assert(p, opts);\nfc.assert(p, bare);\nfc.assert(p, far);`,
      "a.test.ts",
      read,
    );
    expect(got.map((d: { line: number }) => d.line)).toEqual([5, 6]);
  });
});
