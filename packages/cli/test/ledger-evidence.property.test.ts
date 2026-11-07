// Properties of ledger evidence (k.testing Ledger): comments, strings and skipped tests never reach a name, and
// adding them never changes what a file proves. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { testEvidence } from "../src/internal/testEvidence.ts";

const SEED = 1337;
const T = "packages/a/test/t.test.ts";
/** Identifiers that are never keywords. */
const name = fc.stringMatching(/^q[a-zA-Z0-9]{0,7}$/);
const noise = (n: string): string[] => [
  `// ${n}()`,
  `/* ${n}() */`,
  `const s${n.length} = "${n}()";`,
  `it.skip("x", () => ${n}());`,
  `it.todo("${n}");`,
  `describe.skip("x", () => it("y", () => ${n}()));`,
];
const reach = (src: string) =>
  testEvidence([{ path: T, source: src }]).map((r) => ({ names: [...r.names].sort(), ev: r.ev }));

describe("ledger evidence properties", () => {
  it("a name that only appears in comments, strings or skipped tests is never reached", () => {
    fc.assert(
      fc.property(name, fc.array(fc.nat({ max: 5 }), { maxLength: 6 }), (n, picks) => {
        const src = ['import { it, describe } from "vitest";', ...picks.map((i) => noise(n)[i] ?? "")].join("\n");
        expect(reach(src).some((r) => r.names.includes(n))).toBe(false);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("interleaving that noise into a file leaves its evidence unchanged", () => {
    fc.assert(
      fc.property(name, fc.nat({ max: 5 }), fc.integer({ min: 1, max: 400 }), (n, pick, runs) => {
        const body = [
          'import fc from "fast-check";',
          'import { it } from "vitest";',
          `it("t", () => { ${n}(); fc.assert(p, { seed: 1, numRuns: ${runs} }); });`,
        ];
        const noisy = [...body.slice(0, 2), noise(n)[pick] ?? "", body[2] ?? "", noise(n)[pick] ?? ""];
        expect(reach(noisy.join("\n"))).toEqual(reach(body.join("\n")));
        expect(reach(body.join("\n"))).toEqual([
          { names: [n, "assert", "fast-check", "fc"].sort(), ev: { kind: "property", passed: true, runs, seed: 1 } },
        ]);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
