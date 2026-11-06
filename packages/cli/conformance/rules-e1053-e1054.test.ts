// Spec: k.cli Rules E1053 formatter kind registered twice; E1054 record emitted with a kind that has no formatter.
// E1054 is untestable through the public API: the spec names no way to emit a record of an arbitrary kind.
// "Registered custom formatter used by name / listed" is untestable: the spec names `formatter(kind, ...)` only, with no lookup or `--format` name selection.
import { formatter } from "@keel/cli";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED } from "./fixtures";

const Report = s.object({ id: s.string(), total: s.number() });
const def = {
  schema: Report,
  compact: (r: { id: string; total: number }) => `${r.id} ${r.total}`,
  pretty: (r: { id: string; total: number }) => `${r.id}: ${r.total}`,
};
let seq = 0;
const reg = (kind: string): unknown => {
  try {
    formatter(kind, def);
    return undefined;
  } catch (e) {
    return e;
  }
};

describe("k.cli E1053", () => {
  it("E1053 formatter kind registered twice: the second registration reports E1053", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{3,8}\.[a-z]{3,8}$/), (kind) => {
        seq += 1;
        const unique = `${kind}.t${seq}`;
        expect(reg(unique)).toBeUndefined();
        const second = reg(unique);
        expect(String(second instanceof Error ? second.message : second)).toContain("E1053");
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("each kind has exactly one formatter: registering a kernel kind (diag, summary, req, ledger, a11y) again reports E1053", () => {
    for (const kind of ["diag", "summary", "req", "ledger", "a11y"]) {
      const e = reg(kind);
      expect(String(e instanceof Error ? e.message : e)).toContain("E1053");
    }
  });
});
