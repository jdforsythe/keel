// Spec: std.conflicts, clause "On a group whose replayed server holds a rebased lost update, `findRaces` reports it, and on the same group with that transaction `'reject'` it reports none; two runs are byte-equal."
// std.conflicts, rule E2701: a rebased entry races its concurrent entries.
// Seed 1337
// Assumptions: `findRaces`'s `stores` is an array of factories (the spec's "a factory in `stores`"); its `races` is the
// `Race[]` of the replayed store. The group is recorded with `editTodo` `'rebase'`, then replayed against a server and a
// factory that declare it `'rebase'` (the lost update) or `'reject'`.
import { fixedTime } from "@keel/tooling/test-time";
import { openGroup } from "@keel/std-sessions/group";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { STORE_ID, USER, boardStores, groupOptions, lostUpdate, serveWith, findRacesInRoot } from "./fixtures.ts";

const title = fc.stringMatching(/^[a-z]{1,8}$/);

async function record(first: string, second: string) {
  const g = await openGroup(groupOptions("rebase"));
  await lostUpdate(g, first, second);
  return g.stop();
}

describe("std.conflicts: findRaces", () => {
  test(
    "On a group whose replayed server holds a rebased lost update, `findRaces` reports it",
    async () => {
      await fc.assert(
        fc.asyncProperty(title, title, async (first, second) => {
          fc.pre(first !== second);
          const group = await record(first, second);
          const r = await findRacesInRoot(group, { user: USER, serve: serveWith("rebase"), stores: [boardStores()] });
          expect(r.unchecked).toEqual([]);
          expect(r.races).toHaveLength(1);
          expect(r.races[0]).toMatchObject({
            store: STORE_ID,
            kind: "order",
            entry: { id: 2, name: "api.editTodo" },
            against: [{ id: 1, name: "api.editTodo" }],
          });
          expect(r.replay.users).toHaveLength(2);
        }),
        { seed: 1337, numRuns: 3 },
      );
    },
    fixedTime(120_000),
  );

  test(
    "on the same group with that transaction `'reject'` `findRaces` reports none",
    async () => {
      await fc.assert(
        fc.asyncProperty(title, title, async (first, second) => {
          fc.pre(first !== second);
          const group = await record(first, second);
          const r = await findRacesInRoot(group, {
            user: USER,
            serve: serveWith("reject"),
            stores: [boardStores({ edit: "reject" })],
          });
          expect(r.races).toEqual([]);
          expect(r.unchecked).toEqual([]);
        }),
        { seed: 1337, numRuns: 3 },
      );
    },
    fixedTime(120_000),
  );

  test(
    "two runs of `findRaces` on one group are byte-equal",
    async () => {
      const group = await record("Oat milk", "Soy milk");
      const run = () => findRacesInRoot(group, { user: USER, serve: serveWith("rebase"), stores: [boardStores()] });
      const a = await run();
      const b = await run();
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(a.races).toHaveLength(1);
    },
    fixedTime(120_000),
  );
});
