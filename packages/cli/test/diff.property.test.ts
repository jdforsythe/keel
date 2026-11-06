// unifiedDiff and diffEdits are inverses: applying the edits of a file's diff to its old text gives its new text.
// This is the scaffold `--dry-run` guarantee (the diff is exactly what apply writes) and the LSP code-action path. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { diffEdits } from "../src/internal/diffEdits.ts";
import { unifiedDiff } from "../src/internal/unifiedDiff.ts";
import { applyEdits } from "./support/applyEdits.ts";

const SEED = 1337;
const text = fc
  .array(fc.constantFrom("a", "b", "c", "", "  d", "e;"), { maxLength: 40 })
  .map((ls) => ls.map((l) => `${l}\n`).join(""));

describe("unified diff round trip", () => {
  it("applying diffEdits(unifiedDiff(p, a, b)) to a yields b", () => {
    fc.assert(
      fc.property(text, text, (a, b) => {
        const diff = unifiedDiff("src/f.ts", a, b);
        if (a === b) {
          expect(diff).toBe("");
          return;
        }
        expect(applyEdits(a, diffEdits(diff).get("src/f.ts") ?? [])).toBe(b);
      }),
      { seed: SEED, numRuns: 300 },
    );
  });

  it("created and removed files: /dev/null on the absent side", () => {
    fc.assert(
      fc.property(
        text.filter((t) => t !== ""),
        (b) => {
          const created = unifiedDiff("n.ts", null, b);
          expect(created.split("\n").slice(0, 2)).toEqual(["--- /dev/null", "+++ b/n.ts"]);
          expect(applyEdits("", diffEdits(created).get("n.ts") ?? [])).toBe(b);
          const removed = unifiedDiff("n.ts", b, null);
          expect(removed.split("\n").slice(0, 2)).toEqual(["--- a/n.ts", "+++ /dev/null"]);
          expect(applyEdits(b, diffEdits(removed).get("n.ts") ?? [])).toBe("");
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("hunk headers count the lines they carry", () => {
    fc.assert(
      fc.property(text, text, (a, b) => {
        for (const h of unifiedDiff("f", a, b)
          .split(/\n(?=@@)/)
          .slice(1)) {
          const m = /^@@ -\d+,(\d+) \+\d+,(\d+) @@\n?([\s\S]*)$/.exec(h);
          expect(m).not.toBeNull();
          const body = (m?.[3] ?? "").split("\n").filter((l) => l !== "");
          expect(body.filter((l) => !l.startsWith("+")).length).toBe(Number(m?.[1]));
          expect(body.filter((l) => !l.startsWith("-")).length).toBe(Number(m?.[2]));
        }
      }),
      { seed: SEED, numRuns: 200 },
    );
  });
});
