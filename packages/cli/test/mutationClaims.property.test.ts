// Properties for mutation claims (k.ledger Mutation): generated Stryker reports. Seed: 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { mutationClaims } from "../src/internal/mutationClaims.ts";

const STATUSES = ["Killed", "Survived", "NoCoverage", "Timeout", "CompileError", "Ignored", "RuntimeError"] as const;
const FC = { seed: 1337, numRuns: 100 };

const reportArb = fc.dictionary(
  fc.stringMatching(/^src\/[a-z]{1,6}\.ts$/),
  fc.record({
    source: fc.string({ maxLength: 20 }),
    statuses: fc.array(fc.constantFrom(...STATUSES), { maxLength: 30 }),
  }),
  { maxKeys: 6 },
);

describe("mutationClaims", () => {
  it("property: claims from a generated report sum to Stryker's own counts, and the package score is Stryker's", () => {
    fc.assert(
      fc.property(reportArb, fc.integer({ min: 0, max: 100 }), (report, breakAt) => {
        const files = Object.fromEntries(
          Object.entries(report).map(([path, f]) => [
            path,
            {
              language: "typescript",
              source: f.source,
              mutants: f.statuses.map((status, id) => ({ id: `${id}`, status })),
            },
          ]),
        );
        const disk = Object.entries(report).map(([path, f]) => ({ path: `packages/p/${path}`, source: f.source }));
        const json = JSON.stringify({ schemaVersion: "1", thresholds: { high: 90, low: 80, break: breakAt }, files });
        const { mutation, fresh } = mutationClaims(
          [...disk, { path: "packages/p/reports/mutation/mutation.json", source: json }],
          undefined,
        );
        const all = Object.values(report).flatMap((f) => f.statuses);
        const n = (...s: string[]): number => all.filter((x) => s.includes(x)).length;
        const sum = (k: "killed" | "survived" | "noCoverage"): number => mutation.claims.reduce((t, c) => t + c[k], 0);
        expect(sum("killed")).toBe(n("Killed", "Timeout"));
        expect(sum("survived")).toBe(n("Survived"));
        expect(sum("noCoverage")).toBe(n("NoCoverage"));
        expect(fresh.size).toBe(mutation.claims.length);
        const scored = n("Killed", "Timeout", "Survived", "NoCoverage");
        const pkg = mutation.packages.p;
        expect(pkg?.threshold).toBe(breakAt);
        if (scored === 0) expect(pkg?.score).toBeUndefined();
        else expect(pkg?.score).toBeCloseTo((100 * n("Killed", "Timeout")) / scored, 1);
      }),
      FC,
    );
  });

  it("a committed claim whose file left the tree is dropped; one whose file changed stays, stale", () => {
    const sha = "0".repeat(64);
    const claim = (file: string) => ({ file, sha, killed: 1, survived: 0, noCoverage: 0, score: 100 });
    const { mutation, fresh } = mutationClaims([{ path: "packages/p/src/kept.ts", source: "changed" }], {
      packages: { p: { score: 100, threshold: 70 } },
      claims: [claim("packages/p/src/gone.ts"), claim("packages/p/src/kept.ts")],
    });
    expect(mutation.claims.map((c) => c.file)).toEqual(["packages/p/src/kept.ts"]);
    expect([...fresh]).toEqual([]);
    expect(mutation.packages.p).toEqual({ threshold: 70 });
  });

  it("a report entry for a file that left the tree gives no claim", () => {
    const json = JSON.stringify({
      thresholds: { break: 70 },
      files: { "src/gone.ts": { source: "x", mutants: [{ id: "0", status: "Killed" }] } },
    });
    const { mutation } = mutationClaims(
      [{ path: "packages/p/reports/mutation/mutation.json", source: json }],
      undefined,
    );
    expect(mutation.claims).toEqual([]);
  });
});
