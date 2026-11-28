import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { dryRunJson } from "../turbo-dry.mjs";

const doc = {
  id: "x",
  tasks: [{ task: "test", package: "@keel/ctx", directory: "packages/ctx", command: "vitest run" }],
};

describe("dryRunJson", () => {
  it("reads the document after the lines pnpm's install check prints on the first run after a clean", () => {
    const stdout = [
      "Scope: all 62 workspace projects",
      "✓ Lockfile passes supply-chain policies (verified 4h ago)",
      "Lockfile is up to date, resolution step is skipped",
      "Already up to date",
      JSON.stringify(doc, null, 2),
      "",
    ].join("\n");
    expect(dryRunJson(stdout)).toEqual(doc);
  });

  it("reads a document with nothing before it", () => {
    expect(dryRunJson(`${JSON.stringify(doc, null, 2)}\n`)).toEqual(doc);
  });

  it("names the first line when there is no document", () => {
    expect(() => dryRunJson("\nScope: all 62 workspace projects\n")).toThrow(
      "printed no JSON document; its first line: Scope: all 62 workspace projects",
    );
  });

  it("reads any pretty document after any lines that are not `{` alone", () => {
    const line = fc.string({ maxLength: 40 }).filter((s) => !s.includes("\n") && s.trimEnd() !== "{");
    fc.assert(
      fc.property(
        fc.array(line, { maxLength: 6 }),
        fc.dictionary(fc.string(), fc.jsonValue(), { minKeys: 1 }),
        (before, value) => {
          const stdout = [...before, JSON.stringify(value, null, 2)].join("\n");
          expect(dryRunJson(stdout)).toEqual(JSON.parse(JSON.stringify(value)));
        },
      ),
      { numRuns: 200, seed: 1119 },
    );
  });
});
