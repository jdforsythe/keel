// Spec: k.docs, clause "With fixture packages under `node_modules/@keel/`, `keel docs <id>` prints that package's `docs/<id>.md` byte for byte, exit 0; in json, one `docs.section` with the package's `version`."
// Seed 1337 (recorded in the property). Red: the `docs` operation is absent (E1051).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, baseline, jsonRecords, pkg, run } from "./docs-support";

const body = fc
  .array(fc.stringMatching(/^[#A-Za-z0-9 .`|*_-]{0,40}$/), { minLength: 1, maxLength: 12 })
  .map((ls) => `${ls.join("\n")}\n`);

describe("k.docs section", () => {
  it("`keel docs <id>` prints the package's docs/<id>.md byte for byte, exit 0", async () => {
    await fc.assert(
      fc.asyncProperty(body, async (text) => {
        const files = baseline(pkg("router", "2.3.4", [{ id: "k.router", title: "Routes", text }]));
        const r = await run(["docs", "k.router"], { files });
        expect(r.code).toBe(0);
        expect(r.stdout).toContain(text);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("in json, `keel docs <id>` is one docs.section carrying id, package, the package's version and the text", async () => {
    const r = await jsonRecords(["docs", "k.router"], baseline());
    const secs = r.recs.filter((x) => x.kind === "docs.section");
    expect(r.code).toBe(0);
    expect(secs).toHaveLength(1);
    expect(secs[0]).toMatchObject({ id: "k.router", package: "@keel/router", version: "2.3.4" });
    expect(secs[0]?.text).toContain("E1451 duplicate route id.");
  });
});
