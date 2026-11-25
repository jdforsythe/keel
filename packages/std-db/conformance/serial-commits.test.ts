// Spec: std.db, Conformance "For generated sequences of commits from two connections, the stored values equal a serial order of the commits that resolved `true`."
// Seed: 1337.
// Each driver runs the property on two connections to one database (two `open()` calls: two SQLite connections on one file, two pools on one Postgres).
// Values come from a three-element domain so that `expect`s match often enough for both outcomes to occur.
import fc from "fast-check";
import { afterEach, describe, expect, test } from "vitest";
import { KINDS, type Kind, type Rig, SEED, makeRig } from "./fixtures.ts";

const KEYS = ["k0", "k1", "k2"] as const;
const VALUES = ["x", "y", "z"] as const;

interface Write {
  readonly key: string;
  readonly expect: string | null;
  readonly value?: string;
}
type Commit = readonly Write[];

const writeArb = (key: string): fc.Arbitrary<Write> =>
  fc.oneof(
    fc.record({
      key: fc.constant(key),
      expect: fc.option(fc.constantFrom(...VALUES), { nil: null }),
      value: fc.constantFrom(...VALUES),
    }),
    fc.record({ key: fc.constant(key), expect: fc.option(fc.constantFrom(...VALUES), { nil: null }) }),
  );
const commitArb: fc.Arbitrary<Commit> = fc
  .subarray([...KEYS], { minLength: 1 })
  .chain((keys) => fc.tuple(...keys.map(writeArb)));
const sequenceArb = fc.array(commitArb, { minLength: 1, maxLength: 3 });

type Model = ReadonlyMap<string, string>;
const apply = (model: Model, commit: Commit): Model | null => {
  for (const w of commit) if ((model.get(w.key) ?? null) !== w.expect) return null;
  const next = new Map(model);
  for (const w of commit) if (w.value !== undefined) next.set(w.key, w.value);
  return next;
};
const permutations = <T>(xs: readonly T[]): T[][] =>
  xs.length <= 1
    ? [[...xs]]
    : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]));
const sameAs = (model: Model, stored: readonly (string | null)[]): boolean =>
  KEYS.every((k, i) => (model.get(k) ?? null) === (stored[i] ?? null));
const serialOrderExists = (resolved: readonly Commit[], stored: readonly (string | null)[]): boolean =>
  permutations(resolved).some((order) => {
    let model: Model | null = new Map();
    for (const c of order) {
      model = model === null ? null : apply(model, c);
      if (model === null) return false;
    }
    return sameAs(model ?? new Map(), stored);
  });

/** Generated pairs of sequences the property runs on each driver. */
const RUNS = 20;
/**
 * What each driver's case bounds: per run, a fresh database and two connections, at most six commits and two reads.
 * On SQLite that is a file, a few milliseconds a run. On Postgres without `KEEL_TEST_POSTGRES_URL` it is a PGlite
 * engine started and closed, about 300 ms a run here on a quiet machine and up to 1 s beside the suite's other PGlite
 * files; the first run also loads the engine's WebAssembly, about 1.5 s. The bound is 1,000 ms a run on SQLite, and on
 * Postgres 12,000 ms a run and 15,000 ms for the load, so a runner ten times slower (scale 0.1) still has 1.2 s a run
 * and 1.5 s to load.
 */
const BOUND: Readonly<Record<Kind, number>> = { sqlite: RUNS * 1_000, postgres: RUNS * 12_000 + 15_000 };

const rigs: Rig[] = [];
afterEach(async () => {
  for (const r of rigs.splice(0)) await r.stop();
});

for (const kind of KINDS) {
  describe(`${kind} driver`, () => {
    test(
      "For generated sequences of commits from two connections, the stored values equal a serial order of the commits that resolved `true`.",
      async () => {
        await fc.assert(
          fc.asyncProperty(sequenceArb, sequenceArb, async (seqA, seqB) => {
            const rig = await makeRig(kind);
            rigs.push(rig);
            const [a, b] = [await rig.open(), await rig.open()];
            const resolved: Commit[] = [];
            const run = async (storage: typeof a, seq: readonly Commit[]): Promise<void> => {
              for (const c of seq) if (await storage.commit(c.map((w) => ({ ...w })))) resolved.push(c);
            };
            await Promise.all([run(a, seqA), run(b, seqB)]);
            const stored = await a.read([...KEYS]);
            expect(await b.read([...KEYS])).toEqual(stored);
            expect(serialOrderExists(resolved, stored)).toBe(true);
            await rig.stop();
            rigs.pop();
          }),
          { seed: SEED, numRuns: RUNS },
        );
      },
      BOUND[kind],
    );
  });
}
