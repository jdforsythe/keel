import path from "node:path";
import { describe, expect, it } from "vitest";
import { stdEntryDiags } from "../std-entries.mjs";

const root = path.join(import.meta.dirname, "..", "fixtures", "std-entries");
const repo = path.join(import.meta.dirname, "..", "..");

describe("S0009: a std package's runtime entries reach no CLI-time package", () => {
  it("reports the first edge of each offending entry, with the chain from the entry", async () => {
    const { diags, entries } = await stdEntryDiags(root);
    expect(entries).toBe(9);
    expect(diags.map((d) => `${d.code} ${d.path}:${d.line}:${d.col} ${d.message}`)).toEqual([
      "S0009 packages/std-bad/src/register.ts:1:1 entry @fixture/std-bad reaches @keel/cli: src/index.ts > src/register.ts; register in ./tools",
      "S0009 packages/testing/src/leak.ts:1:1 entry @fixture/std-bad/harness reaches @keel/cli: src/harness.ts > packages/testing/src/leak.ts; register in ./tools",
      "S0009 packages/std-bad/src/late.ts:1:1 entry @fixture/std-bad/late reaches @keel/check: src/late.ts; register in ./tools",
      "S0009 packages/std-bad/src/parse.ts:1:1 entry @fixture/std-bad/parse reaches oxc-parser: src/parse.ts; register in ./tools",
      "S0009 packages/std-pattern/src/routes.ts:1:1 entry @fixture/std-pattern/routes reaches typescript: src/routes.ts; register in ./tools",
    ]);
  });
  it("leaves ./tools, keys under it, ./module and ./package.json alone, in a pattern too", async () => {
    const { diags } = await stdEntryDiags(root);
    expect(diags.filter((d) => /tools|module|package\.json/.test(d.path))).toEqual([]);
  });
  it("lets an entry reach the testing package and walks through it", async () => {
    const { diags } = await stdEntryDiags(root);
    expect(diags.filter((d) => d.path.includes("std-ok") || d.path.endsWith("testing/src/index.ts"))).toEqual([]);
  });
  it("is green on this repository", async () => {
    expect((await stdEntryDiags(repo)).diags).toEqual([]);
  });
  it("has nothing to report where there is no std package", async () => {
    expect(await stdEntryDiags(path.join(root, "packages", "cli"))).toEqual({ diags: [], entries: 0 });
  });
});
