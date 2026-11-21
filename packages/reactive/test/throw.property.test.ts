// Throwing computeds in any DAG (chains, diamonds, several readers). fast-check seed 1337.
// A computed throws for some of its values; a node reading a throwing node throws the same error. After each commit:
// every computed ran at most once, only if a source of it changed, and exactly once when a reader reaches it; each
// reader ran exactly once when its node's outcome changed (a new value, a throw, a value after a throw, also the value
// from before the throw) and not otherwise; each reader saw the model's outcome. A retry follows only the sources the
// throwing run read.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { batch, computed, effect, scope, signal } from "../src/index.ts";
import type { Signal } from "../src/index.ts";

const SEED = 1337;
const SOURCES = 3;

interface Spec {
  deps: number[];
  mod: boolean;
  /** Throws when its value mod 4 is this residue; never when null. */
  bad: number | null;
}
type Outcome = { readonly err: false; readonly v: number } | { readonly err: true };

const specArb = fc.array(
  fc.record({
    deps: fc.array(fc.nat({ max: 1000 }), { minLength: 1, maxLength: 3 }),
    mod: fc.boolean(),
    bad: fc.option(fc.nat({ max: 3 }), { nil: null }),
  }),
  { minLength: 1, maxLength: 10 },
);
const readersArb = fc.array(fc.nat({ max: 1000 }), { minLength: 1, maxLength: 5 });
/** Small values so a source returns to an earlier value and a computed to its value from before a throw. */
const commitsArb = fc.array(
  fc.array(fc.tuple(fc.nat({ max: SOURCES - 1 }), fc.integer({ min: -2, max: 2 })), { minLength: 1, maxLength: 3 }),
  { maxLength: 20 },
);

const normalize = (raw: Spec[]): Spec[] =>
  raw.map((s, i) => ({ deps: s.deps.map((d) => d % (SOURCES + i)), mod: s.mod, bad: s.bad }));
const nodeValue = (spec: Spec, sum: number): number => (spec.mod ? ((sum % 3) + 3) % 3 : sum);
const throwsAt = (spec: Spec, v: number): boolean => spec.bad !== null && ((v % 4) + 4) % 4 === spec.bad;

/**
 * Pure reference: the outcome of every node for the given source values, and the nodes each computed reads (its deps
 * up to the first that throws: reading that one throws, so the rest are not read).
 */
const model = (specs: Spec[], src: readonly number[]): { out: Outcome[]; reads: number[][] } => {
  const out: Outcome[] = src.map((v) => ({ err: false, v }));
  const reads: number[][] = src.map(() => []);
  for (const spec of specs) {
    let sum = 0;
    let err = false;
    const read: number[] = [];
    for (const d of spec.deps) {
      read.push(d);
      const o = out[d];
      if (o === undefined || o.err) {
        err = true;
        break;
      }
      sum += o.v;
    }
    reads.push(read);
    const v = nodeValue(spec, sum);
    out.push(err || throwsAt(spec, v) ? { err: true } : { err: false, v });
  }
  return { out, reads };
};

const same = (a: Outcome | undefined, b: Outcome | undefined): boolean =>
  a !== undefined && b !== undefined && !a.err && !b.err && a.v === b.v;

describe("throwing computeds", () => {
  it("run once per commit, only on a source change, and rerun each reader exactly when its outcome changed", () => {
    fc.assert(
      fc.property(specArb, readersArb, commitsArb, (raw, rawReaders, commits) => {
        const specs = normalize(raw);
        const total = SOURCES + specs.length;
        const readers = rawReaders.map((r) => r % total);
        const src = [0, 0, 0];
        const runs = specs.map(() => 0);
        const readerRuns = readers.map(() => 0);
        const seen: Outcome[][] = readers.map(() => []);
        const sc = scope(() => {
          const sources: Signal<number>[] = src.map((v) => signal(v));
          const nodes: Array<{ get(): number }> = [...sources];
          specs.forEach((spec, i) => {
            const snapshot = [...nodes];
            nodes.push(
              computed(() => {
                runs[i] = (runs[i] ?? 0) + 1;
                let sum = 0;
                for (const d of spec.deps) sum += snapshot[d]?.get() ?? 0;
                const v = nodeValue(spec, sum);
                if (throwsAt(spec, v)) throw new Error(`node ${SOURCES + i}`);
                return v;
              }),
            );
          });
          readers.forEach((r, k) => {
            effect(() => {
              readerRuns[k] = (readerRuns[k] ?? 0) + 1;
              try {
                seen[k]?.push({ err: false, v: nodes[r]?.get() ?? Number.NaN });
              } catch {
                seen[k]?.push({ err: true });
              }
            });
          });
          const first = model(specs, src);
          let prev = first.out;
          const tracked = first.reads;
          const stale = specs.map(() => false);
          readers.forEach((r, k) => {
            expect(seen[k]?.at(-1)).toEqual(prev[r]);
          });
          for (const writes of commits) {
            // A source changed when one of this commit's writes gave it a new value (a later write back counts too).
            const touched = src.map(() => false);
            for (const [j, v] of writes) {
              if (src[j] !== v) touched[j] = true;
              src[j] = v;
            }
            const { out: next, reads } = model(specs, src);
            // Which nodes reran (a source of theirs changed) and which changed (their readers rerun).
            const changed: boolean[] = [];
            const reran: boolean[] = [];
            for (let i = 0; i < total; i++) {
              if (i < SOURCES) {
                reran.push(false);
                changed.push(touched[i] === true);
                continue;
              }
              const r = (tracked[i] ?? []).some((d) => changed[d] === true);
              if (r) tracked[i] = reads[i] ?? [];
              reran.push(r);
              changed.push(r && !same(prev[i], next[i]));
            }
            const runsBefore = [...runs];
            const readerBefore = [...readerRuns];
            const apply = (): void => {
              for (const [j, v] of writes) sources[j]?.set(v);
            };
            if (writes.length > 1) batch(apply);
            else apply();
            // Nodes a reader reaches now: what the readers read, and what those read, as of this commit.
            const reached = new Set<number>();
            const visit = (i: number): void => {
              if (reached.has(i)) return;
              reached.add(i);
              for (const d of reads[i] ?? []) visit(d);
            };
            for (const r of readers) visit(r);
            specs.forEach((_, i) => {
              // Only after a source change since its last run (a node nothing observes catches up lazily on its next
              // read; a first read evaluates it); exactly once when a reader reaches it, else at most once.
              const ran = (runs[i] ?? 0) - (runsBefore[i] ?? 0);
              const fresh = (runsBefore[i] ?? 0) === 0;
              if (reran[SOURCES + i] === true) stale[i] = true;
              const due = fresh || stale[i] === true;
              if (due && reached.has(SOURCES + i)) expect(ran).toBe(1);
              else expect(ran).toBeLessThanOrEqual(due ? 1 : 0);
              if (ran > 0) stale[i] = false;
            });
            readers.forEach((r, k) => {
              expect((readerRuns[k] ?? 0) - (readerBefore[k] ?? 0)).toBe(changed[r] === true ? 1 : 0);
              expect(seen[k]?.at(-1)).toEqual(next[r]);
            });
            prev = next;
          }
        });
        sc.dispose();
      }),
      { seed: SEED, numRuns: 300 },
    );
  });
  it("a retry follows only the sources the throwing run read; one that threw before reading any keeps its error", () => {
    // `gate` odd throws before `x` is read; even reads `x`. `none` throws before reading anything.
    const writeArb = fc.array(fc.tuple(fc.boolean(), fc.integer({ min: 0, max: 3 })), { maxLength: 30 });
    fc.assert(
      fc.property(writeArb, (writes) => {
        let runs = 0;
        let noneRuns = 0;
        const seen: string[] = [];
        let write: (toGate: boolean, v: number) => void = () => {};
        const sc = scope(() => {
          const gate = signal(0);
          const x = signal(0);
          write = (toGate, v) => (toGate ? gate.set(v) : x.set(v));
          const c = computed(() => {
            runs++;
            const g = gate.get();
            if (g % 2 === 1) throw new Error(`gate ${g}`);
            return g + x.get();
          });
          const none = computed((): number => {
            noneRuns++;
            throw new Error("none");
          });
          effect(() => {
            try {
              seen.push(`v${c.get()}`);
            } catch (e) {
              seen.push(e instanceof Error ? e.message : "other");
            }
            try {
              none.get();
            } catch {
              // Read for its run count only.
            }
          });
        });
        let g = 0;
        let xv = 0;
        let expectedRuns = 1;
        for (const [toGate, v] of writes) {
          // Read by the last run: `gate` always, `x` only when that run did not throw first.
          const readX = g % 2 === 0;
          const changed = toGate ? v !== g : v !== xv && readX;
          if (toGate) g = v;
          else xv = v;
          if (changed) expectedRuns++;
          write(toGate, v);
          expect(runs).toBe(expectedRuns);
          expect(seen.at(-1)).toBe(g % 2 === 1 ? `gate ${g}` : `v${g + xv}`);
        }
        expect(noneRuns).toBe(1);
        expect(seen.length).toBeGreaterThan(0);
        sc.dispose();
      }),
      { seed: SEED, numRuns: 300 },
    );
  });
});
