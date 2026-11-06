// Seed 1337
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { format } from "../src/index.ts";
import { arbDiagnostic, keyOf } from "./support/arbDiagnostic.ts";

const SEED = 1337;
const lines = (s: string): string[] => s.split("\n").filter((l) => l !== "");
const uniqueByCode = (ds: readonly { code: string }[]): Map<string, number> => {
  const m = new Map<string, number>();
  for (const d of ds) m.set(d.code, (m.get(d.code) ?? 0) + 1);
  return m;
};
const unique = <T extends Parameters<typeof keyOf>[0]>(ds: readonly T[]): T[] => {
  const seen = new Map<string, T>();
  for (const d of ds) if (!seen.has(keyOf(d))) seen.set(keyOf(d), d);
  return [...seen.values()];
};

describe("format compact", () => {
  it("caps each code at the limit and reports the exact remainder", () => {
    fc.assert(
      fc.property(fc.array(arbDiagnostic, { maxLength: 60 }), fc.integer({ min: 1, max: 8 }), (ds, limit) => {
        const out = format(ds, { mode: "compact", limit });
        for (const [code, n] of uniqueByCode(unique(ds))) {
          expect(lines(out).filter((l) => l.startsWith(`${code} `)).length).toBe(Math.min(n, limit));
          const more = `... +${n - limit} more ${code} (keel check --code ${code})`;
          if (n > limit) expect(out).toContain(more);
          else expect(out).not.toContain(`more ${code} `);
        }
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("groups appear in code order, one block per code", () => {
    fc.assert(
      fc.property(fc.array(arbDiagnostic, { maxLength: 40 }), (ds) => {
        const codes = lines(format(ds, { mode: "compact" }))
          .map((l) => /^([EWI]\d{4}) /.exec(l)?.[1])
          .filter((c): c is string => c !== undefined);
        const blocks = codes.filter((c, i) => i === 0 || codes[i - 1] !== c);
        expect(blocks).toEqual([...new Set(codes)].sort());
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("is invariant under input order and duplication", () => {
    fc.assert(
      fc.property(
        fc
          .array(arbDiagnostic, { maxLength: 30 })
          .chain((ds) =>
            fc.tuple(fc.constant(ds), fc.shuffledSubarray(ds, { minLength: ds.length, maxLength: ds.length })),
          ),
        fc.constantFrom("compact", "json", "pretty"),
        ([ds, perm], mode) => {
          const a = format(ds, { mode });
          expect(format(perm, { mode })).toBe(a);
          expect(format([...ds, ...perm], { mode })).toBe(a);
        },
      ),
      { seed: SEED, numRuns: 150 },
    );
  });

  it("ends with exactly one trailer: ok iff no E code; quiet prints only it", () => {
    fc.assert(
      fc.property(fc.array(arbDiagnostic, { maxLength: 30 }), (ds) => {
        const out = lines(format(ds, { mode: "compact" }));
        const last = out[out.length - 1] ?? "";
        const failing = ds.some((d) => d.code.startsWith("E"));
        expect(last.startsWith(failing ? "fail check: " : "ok check: ")).toBe(true);
        expect(lines(format(ds, { mode: "compact", quiet: true }))).toEqual([last]);
      }),
      { seed: SEED, numRuns: 150 },
    );
  });

  it("--code keeps one code and leaves the trailer unchanged", () => {
    fc.assert(
      fc.property(fc.array(arbDiagnostic, { minLength: 1, maxLength: 30 }), (ds) => {
        const code = ds[0]?.code ?? "E1001";
        const all = lines(format(ds, { mode: "compact" }));
        const only = lines(format(ds, { mode: "compact", code }));
        expect(only[only.length - 1]).toBe(all[all.length - 1]);
        const shown = only.map((l) => /^([EWI]\d{4}) /.exec(l)?.[1]).filter((c) => c !== undefined);
        expect(new Set(shown)).toEqual(new Set([code]));
      }),
      { seed: SEED, numRuns: 150 },
    );
  });
});

describe("format json", () => {
  it("emits every unique diagnostic once, then a summary whose counts match", () => {
    fc.assert(
      fc.property(fc.array(arbDiagnostic, { maxLength: 40 }), (ds) => {
        const out = lines(format(ds, { mode: "json" })).map((l) => JSON.parse(l));
        const u = unique(ds);
        expect(out.length).toBe(u.length + 1);
        const summary = out[out.length - 1];
        expect(summary.kind).toBe("summary");
        expect(summary.counts).toEqual(Object.fromEntries([...uniqueByCode(u)].sort(([a], [b]) => (a < b ? -1 : 1))));
      }),
      { seed: SEED, numRuns: 150 },
    );
  });
});
