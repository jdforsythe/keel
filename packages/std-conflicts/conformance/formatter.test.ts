// Spec: std.conflicts, clause "The `conflicts.race` formatter renders a race as E2701 and an unchecked entry as W2702 in compact and json."
// std.conflicts, rule E2701: a rebased entry races its concurrent entries (diag at the file, 1:1).
// std.conflicts, rule W2702: a rebased entry whose base state cannot be rebuilt (diag at the file, 1:1).
// Seed 1337
// Records are built by `raceRecords(path, { races, unchecked }, server)` from `races` on the fixtures and rendered
// with `respond` from `@keel/cli/testing`; the registration test relies only on k.cli: a second `formatter` of one kind is E1053.
import { formatter } from "@keel/cli";
import { respond } from "@keel/cli/testing";
import { s } from "@keel/schema";
import { raceRecords } from "@keel/std-conflicts";
import "@keel/std-conflicts/tools";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { STORE_ID, boardStores, snapshotOf, racesInRoot } from "./fixtures.ts";

describe("std.conflicts: the conflicts.race formatter", () => {
  test("importing @keel/std-conflicts/tools registers the `conflicts.race` record kind (a second registration is E1053)", () => {
    expect(() => formatter("conflicts.race", { schema: s.object({}), compact: () => "", pretty: () => "" })).toThrow(
      /E1053/,
    );
  });
});

const PATH = "group.json";
const ref = (id: number) => ({ id, name: "api.editTodo" });

/** `n` plain edits (no `base`, never examined) then one rebased edit from head 1: one order race against all `n`. */
const raceOf = (n: number) => {
  const ops = [
    { t: "add" as const, id: "x", title: "x" },
    ...Array.from({ length: n }, (_, i) => ({ t: "edit" as const, id: "x", title: `t${i}`, base: i + 1 })),
    { t: "edit" as const, id: "x", title: "last", base: 1 },
  ];
  // the middle edits carry base = head so they are plain; only the last is rebased
  const snap = snapshotOf({}, ops);
  const report = racesInRoot(snap, boardStores());
  return { snap, records: raceRecords(PATH, report, { [STORE_ID]: snap }), n };
};

const uncheckedOf = () => {
  const snap = snapshotOf({ logLimit: 2 }, [
    { t: "add", id: "x", title: "x" },
    { t: "edit", id: "x", title: "a", base: 1 },
    { t: "edit", id: "x", title: "b", base: 2 },
    { t: "edit", id: "x", title: "c", base: 1 },
  ]);
  const report = racesInRoot(snap, boardStores({ logLimit: 2 }));
  return raceRecords(PATH, report, { [STORE_ID]: snap });
};

const lines = (stdout: string) => stdout.split("\n").filter((l) => l !== "");

describe("std.conflicts: the conflicts.race records", () => {
  test("The `conflicts.race` formatter renders a race as E2701 in compact", () => {
    const { records } = raceOf(1);
    const r = respond(records, { format: "compact" });
    expect(r.records.some((x) => x.kind === "diag" && x.code === "E1054")).toBe(false);
    expect(lines(r.stdout)).toEqual([`E2701 ${PATH}:1:1 race api.editTodo #3 over api.editTodo #2 on ${STORE_ID}`]);
  });

  test("The `conflicts.race` formatter renders a race as E2701 in json", () => {
    const { records } = raceOf(1);
    const r = respond(records, { format: "json" });
    expect(lines(r.stdout).map((l): unknown => JSON.parse(l))).toEqual([
      {
        kind: "conflicts.race",
        code: "E2701",
        path: PATH,
        store: STORE_ID,
        entry: ref(3),
        against: [ref(2)],
        reason: "order",
      },
    ]);
  });

  test("The `conflicts.race` formatter renders an unchecked entry as W2702 in compact", () => {
    const r = respond(uncheckedOf(), { format: "compact" });
    expect(lines(r.stdout)).toEqual([`W2702 ${PATH}:1:1 unchecked api.editTodo #4 on ${STORE_ID} (folded)`]);
  });

  test("The `conflicts.race` formatter renders an unchecked entry as W2702 in json", () => {
    const r = respond(uncheckedOf(), { format: "json" });
    expect(lines(r.stdout).map((l): unknown => JSON.parse(l))).toEqual([
      {
        kind: "conflicts.race",
        code: "W2702",
        path: PATH,
        store: STORE_ID,
        entry: ref(4),
        against: [],
        reason: "folded",
      },
    ]);
  });

  test("E2701 compact lists at most two of `against`, then ` +n` before ` on <store>`", () => {
    // fast-check seed 1337
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 6 }), (n) => {
        const { records } = raceOf(n);
        const out = lines(respond(records, { format: "compact" }).stdout);
        const shown = Array.from({ length: Math.min(n, 2) }, (_, i) => `api.editTodo #${i + 2}`).join(", ");
        const more = n > 2 ? ` +${n - 2}` : "";
        expect(out).toEqual([`E2701 ${PATH}:1:1 race api.editTodo #${n + 2} over ${shown}${more} on ${STORE_ID}`]);
        // the record keeps every entry of `against`
        const rec = records[0];
        expect(rec?.against).toHaveLength(n);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  test("E2701 and W2702 diag the file at 1:1", () => {
    const all = [...raceOf(1).records, ...uncheckedOf()];
    const compact = lines(respond(all, { format: "compact" }).stdout);
    expect(compact).toHaveLength(2);
    for (const l of compact) expect(l).toMatch(new RegExp(` ${PATH}:1:1 `));
    const json = lines(respond(all, { format: "json" }).stdout).map((l): unknown => JSON.parse(l));
    for (const rec of json) expect(rec).toMatchObject({ kind: "conflicts.race", path: PATH });
  });
});
