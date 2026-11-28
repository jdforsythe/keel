// Spec: k.docs, clause "`keel docs nope` and `keel docs k.cli --for E1051` emit E1052, exit 2. `keel spec` emits E1051."
// Seed: none. Red: `docs` is absent, so the first two answer E1051 not E1052; `spec` is still an operation, so E1051 is not yet emitted.
import { describe, expect, it } from "vitest";
import { baseline, run } from "./docs-support";

describe("k.docs E1052 and removed spec", () => {
  it("`keel docs nope` emits E1052, exit 2", async () => {
    const r = await run(["docs", "nope"], { files: baseline() });
    expect(r.code).toBe(2);
    expect(r.stdout + r.stderr).toContain("E1052");
  });

  it("`keel docs k.cli --for E1051` emits E1052, exit 2", async () => {
    const r = await run(["docs", "k.cli", "--for", "E1051"], { files: baseline() });
    expect(r.code).toBe(2);
    expect(r.stdout + r.stderr).toContain("E1052");
  });

  it("`keel docs k.router --sync` and `keel docs --for E1451 --sync` emit E1052, exit 2", async () => {
    for (const argv of [
      ["docs", "k.router", "--sync"],
      ["docs", "--for", "E1451", "--sync"],
    ]) {
      const r = await run(argv, { files: baseline() });
      expect(r.code).toBe(2);
      expect(r.stdout + r.stderr).toContain("E1052");
    }
  });

  it("`keel spec` emits E1051, exit 2", async () => {
    const r = await run(["spec", "k.cli"], { files: baseline() });
    expect(r.code).toBe(2);
    expect(r.stdout + r.stderr).toContain("E1051");
  });
});
