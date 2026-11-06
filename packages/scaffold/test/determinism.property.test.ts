// Properties: operations are pure and deterministic; plan equals scaffold; refusals write nothing.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Op, plan, scaffold } from "../src/index.ts";
import { RUNS, SEED, lower, snap, tree, upper } from "./helpers.ts";

const call = (t: { modules: string[]; components: string[]; stores: string[] }, n: string, P: string) => {
  const mod = t.modules[0] ?? "app";
  const calls: [Op, Record<string, unknown>][] = [
    ["module", { id: n }],
    ["component", { id: `${mod}/${P}` }],
    ["store", { id: `${mod}.${n}` }],
    ["route", { id: `${mod}.${n}`, path: `/${n}` }],
    ["rename", { kind: "component", from: t.components[0] ?? "", to: P }],
    ["move", { name: t.components[0] ?? "", to: "app" }],
    ["add-field", { schema: "Nope", field: n, type: "int" }],
    [
      "add-field",
      {
        schema: `${(t.stores[0] ?? ".x").split(".")[1]?.replace(/^./, (c) => c.toUpperCase())}State`,
        field: n,
        type: "int",
        default: 1,
      },
    ],
    ["component", { id: `${mod}/${n}` }],
  ];
  return calls;
};

describe("determinism", () => {
  it("every operation twice on equal input gives byte-identical results, and plan equals scaffold", () => {
    fc.assert(
      fc.property(tree, lower, upper, (t, n, P) => {
        fc.pre(!t.modules.includes(n) && !t.components.includes(P));
        for (const [op, input] of call(t, n, P)) {
          const before = snap(t.files);
          const a = scaffold(op, input, t.files);
          const b = scaffold(op, input, new Map(t.files));
          const p = plan(op, input, t.files);
          expect(snap(t.files), op).toBe(before);
          expect(JSON.stringify(a.ok ? { ...a.value, files: snap(a.value.files) } : a), op).toBe(
            JSON.stringify(b.ok ? { ...b.value, files: snap(b.value.files) } : b),
          );
          expect(JSON.stringify(p.ok ? { ...p.value, files: snap(p.value.files) } : p), op).toBe(
            JSON.stringify(a.ok ? { ...a.value, files: snap(a.value.files) } : a),
          );
        }
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("the edit set is exactly the difference between the trees", () => {
    fc.assert(
      fc.property(tree, upper, (t, P) => {
        fc.pre(!t.components.includes(P));
        const r = scaffold("rename", { kind: "component", from: t.components[0] ?? "", to: P }, t.files);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const { files, created, changed, removed } = r.value;
        for (const p of created) expect(t.files.has(p) || !files.has(p), p).toBe(false);
        for (const p of removed) expect(t.files.has(p) && !files.has(p), p).toBe(true);
        for (const p of changed) expect(t.files.get(p) !== files.get(p) && files.has(p), p).toBe(true);
        const touched = new Set([...created, ...changed, ...removed]);
        for (const [p, c] of t.files) if (!touched.has(p)) expect(files.get(p), p).toBe(c);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
