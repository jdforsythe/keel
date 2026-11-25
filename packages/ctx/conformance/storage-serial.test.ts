// Spec: k.persist, clause "For generated interleavings of `commit`s from two apps on one sim ctx, the stored values equal a serial order of the commits that resolved `true`, and a `read` never returns a value from between two writes of one `commit`."
// Seed: 1337.
// The two apps are two actors issuing calls on one sim ctx's `ctx.storage` (the shared storage of k.persist Storage).
// Every commit writes keys `a` and `b` the same value under the same `expect`, so a read of both that differs would show a cut between two writes.
import { createCtx } from "@keel/ctx";
import fc from "fast-check";
import { expect, it } from "vitest";

const SEED = 1337;
const VALUES = ["x0", "x1", "x2"] as const;

type Op =
  | { readonly kind: "commit"; readonly app: 0 | 1; readonly expect: string | null; readonly value: string }
  | { readonly kind: "read"; readonly app: 0 | 1 };

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({
    kind: fc.constant("commit" as const),
    app: fc.constantFrom<0 | 1>(0, 1),
    expect: fc.constantFrom<string | null>(null, ...VALUES),
    value: fc.constantFrom(...VALUES),
  }),
  fc.record({ kind: fc.constant("read" as const), app: fc.constantFrom<0 | 1>(0, 1) }),
);

const yieldTurns = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

function permutations<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [[...xs]];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]));
}

/** Whether some order of `commits` applies one after the other, each against the state the earlier ones left, and ends at `final`. */
function someSerialOrder(
  commits: ReadonlyArray<{ expect: string | null; value: string }>,
  final: string | null,
): boolean {
  return permutations(commits).some((order) => {
    let state: string | null = null;
    for (const c of order) {
      if (state !== c.expect) return false;
      state = c.value;
    }
    return state === final;
  });
}

it("for generated interleavings of `commit`s from two apps on one sim ctx, the stored values equal a serial order of the commits that resolved `true`, and a `read` never returns a value from between two writes of one `commit`", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(opArb, { minLength: 2, maxLength: 7 }),
      fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 7, maxLength: 7 }),
      async (ops, gaps) => {
        const ctx = createCtx({ mode: "sim", seed: SEED });
        const pending: Array<Promise<{ op: Op; result: boolean | (string | null)[] }>> = [];
        // Each app's calls are issued in its own order; the two apps interleave by the generated gaps (microtask turns).
        for (const [i, op] of ops.entries()) {
          pending.push(
            op.kind === "commit"
              ? ctx.storage
                  .commit([
                    { key: "a", expect: op.expect, value: op.value },
                    { key: "b", expect: op.expect, value: op.value },
                  ])
                  .then((result) => ({ op, result }))
              : ctx.storage.read(["a", "b"]).then((result) => ({ op, result })),
          );
          await yieldTurns(gaps[i] ?? 0);
        }
        const done = await Promise.all(pending);

        const accepted: Array<{ expect: string | null; value: string }> = [];
        for (const { op, result } of done) {
          if (op.kind === "commit") {
            if (result === true) accepted.push({ expect: op.expect, value: op.value });
          } else {
            expect(Array.isArray(result)).toBe(true);
            if (Array.isArray(result)) expect(result[0]).toBe(result[1]);
          }
        }
        const [a, b] = await ctx.storage.read(["a", "b"]);
        expect(a).toBe(b ?? null);
        expect(someSerialOrder(accepted, a ?? null)).toBe(true);
      },
    ),
    { seed: SEED, numRuns: 100 },
  );
});
