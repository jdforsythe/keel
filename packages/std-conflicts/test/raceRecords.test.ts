import { respond } from "@keel/cli/testing";
import { type RaceReport, raceRecords } from "@keel/std-conflicts";
import type { Snapshot } from "@keel/store";
import { describe, expect, test } from "vitest";

const ref = (id: number, name: string) => ({ id, name });
const found = (against: number): RaceReport => ({
  races: [
    {
      store: "api.board",
      entry: { id: 6, name: "api.editTodo", key: "k6" },
      against: Array.from({ length: against }, (_, i) => ref(4 + i, i % 2 === 0 ? "api.editTodo" : "api.addTodo")),
      kind: "order",
    },
  ],
  unchecked: [{ store: "api.board", id: 7, reason: "folded" }],
});
const server: { [store: string]: Snapshot<unknown> } = {
  "api.board": {
    state: {},
    initial: {},
    head: 7,
    log: [{ id: 7, name: "api.editTodo", payload: {}, at: 7, base: 1 }],
  },
};
const FILE = ".keel/sessions/g.group.json";

describe("conflicts.race records", () => {
  test("a race renders as E2701 and an unchecked entry as W2702 in compact", () => {
    const out = respond(raceRecords(FILE, found(2), server));
    expect(out.stdout.split("\n").slice(0, 2)).toEqual([
      `E2701 ${FILE}:1:1 race api.editTodo #6 over api.editTodo #4, api.addTodo #5 on api.board`,
      `W2702 ${FILE}:1:1 unchecked api.editTodo #7 on api.board (folded)`,
    ]);
  });

  test("compact lists at most two of against, then +n", () => {
    const [line] = respond(raceRecords(FILE, { races: found(4).races, unchecked: [] }, server)).stdout.split("\n");
    expect(line).toBe(`E2701 ${FILE}:1:1 race api.editTodo #6 over api.editTodo #4, api.addTodo #5 +2 on api.board`);
  });

  test("json is the record encoded by its schema", () => {
    const lines = respond(raceRecords(FILE, found(1), server), { format: "json" })
      .stdout.split("\n")
      .filter((l) => l.startsWith('{"kind":"conflicts.race"'))
      .map((l): unknown => JSON.parse(l));
    expect(lines).toEqual([
      {
        kind: "conflicts.race",
        code: "E2701",
        path: FILE,
        store: "api.board",
        entry: { id: 6, name: "api.editTodo", key: "k6" },
        against: [{ id: 4, name: "api.editTodo" }],
        reason: "order",
      },
      {
        kind: "conflicts.race",
        code: "W2702",
        path: FILE,
        store: "api.board",
        entry: { id: 7, name: "api.editTodo" },
        against: [],
        reason: "folded",
      },
    ]);
  });

  test("pretty adds each concurrent entry and what the reason means", () => {
    const out = respond(raceRecords(FILE, found(1), server), { format: "pretty" }).stdout;
    expect(out).toContain("over api.editTodo #4");
    expect(out).toContain("'reject'");
  });
});
