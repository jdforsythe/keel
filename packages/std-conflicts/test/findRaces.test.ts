// findRaces over stored server values that are not valid snapshots: each is skipped, never thrown. The replay is
// stubbed so the server values are exactly the ones under test.
import { type StoresFactory, findRaces } from "@keel/std-conflicts";
import type { SessionGroup } from "@keel/std-sessions/group";
import { describe, expect, test, vi } from "vitest";
import { boardStores, root, snapshotAfter, tallyStores } from "./helpers.ts";

const server = vi.hoisted((): { [store: string]: unknown } => ({}));

vi.mock("@keel/std-sessions/group", () => ({
  replayGroup: async () => ({ users: [], server, reproduced: true }),
}));

const group: SessionGroup = { v: 1, seed: 1337, at: 0, origin: "http://test", server: {}, users: [] };
const serve = () => ({ fetch: async () => new Response(null, { status: 404 }) });
const run = (stores: readonly StoresFactory[] = [boardStores()]) =>
  root(() => findRaces(group, { user: "user.ts", serve, stores }));

describe("findRaces on stored values that are not snapshots", () => {
  const race = snapshotAfter(boardStores(), [
    { name: "t.add", payload: { id: "a", title: "x" } },
    { name: "t.rename", payload: { id: "a", title: "y" } },
    { name: "t.rename", payload: { id: "a", title: "w" }, base: 1 },
  ]);
  const values: readonly unknown[] = [
    "not json {",
    "",
    "null",
    "42",
    JSON.stringify({ state: { titles: [] }, log: [null], initial: { titles: [] } }),
    JSON.stringify({ state: { titles: [] }, log: [{ name: "t.add" }], initial: { titles: [] } }),
    JSON.stringify({ state: { titles: 1 }, log: [], initial: { titles: [] } }),
    JSON.stringify({ ...race, log: [...race.log, { name: "t.nope", payload: {}, at: 9, id: 9 }] }),
    { state: { titles: [] }, log: [null], initial: { titles: [] } },
  ];

  for (const value of values)
    test(`a stored value ${JSON.stringify(value)} is skipped`, async () => {
      for (const k of Object.keys(server)) delete server[k];
      server["t.board"] = value;
      const r = await run();
      expect({ races: r.races, unchecked: r.unchecked }).toEqual({ races: [], unchecked: [] });
    });

  test("a valid stored snapshot, as JSON text or as a value, is examined", async () => {
    for (const value of [JSON.stringify(race), race]) {
      for (const k of Object.keys(server)) delete server[k];
      server["t.board"] = value;
      const r = await run();
      expect(r.races.map((x) => [x.store, x.entry.id, x.kind])).toEqual([["t.board", 3, "order"]]);
    }
  });

  test("a factory without the stored store is passed over for the next one", async () => {
    for (const k of Object.keys(server)) delete server[k];
    server["t.board"] = JSON.stringify(race);
    const r = await run([tallyStores(), boardStores()]);
    expect(r.races.map((x) => x.store)).toEqual(["t.board"]);
  });
});
