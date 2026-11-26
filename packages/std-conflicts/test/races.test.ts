import { s } from "@keel/schema";
import { races as racesOf } from "@keel/std-conflicts";
import { store, transaction } from "@keel/store";
import { describe, expect, test } from "vitest";
import { boardStores, root, snapshotAfter, tallyStores } from "./helpers.ts";

const races: typeof racesOf = (...args) => root(() => racesOf(...args));

const add = (id: string, title: string, base?: number) => ({
  name: "t.add",
  payload: { id, title },
  ...(base === undefined ? {} : { base }),
});
const rename = (id: string, title: string, base?: number) => ({
  name: "t.rename",
  payload: { id, title },
  ...(base === undefined ? {} : { base }),
});

describe("races", () => {
  test("an order race names the entry and every concurrent entry, keys included", () => {
    const snap = snapshotAfter(boardStores(), [add("a", "x"), rename("a", "y"), add("b", "z"), rename("a", "w", 1)]);
    expect(races(snap, boardStores())).toEqual({
      races: [
        {
          store: "t.board",
          entry: { id: 4, name: "t.rename" },
          against: [
            { id: 2, name: "t.rename" },
            { id: 3, name: "t.add" },
          ],
          kind: "order",
        },
      ],
      unchecked: [],
    });
  });

  test("an entry whose other order fails an invariant is an invalid race", () => {
    // live: a=x, b=y, a=z, then b=x from base 2 holds; b=x first would give two items titled x
    const snap = snapshotAfter(boardStores(), [add("a", "x"), add("b", "y"), rename("a", "z"), rename("b", "x", 2)]);
    const r = races(snap, boardStores());
    expect(r.races.map((x) => x.kind)).toEqual(["invalid"]);
  });

  test("a factory with no store for the snapshot throws", () => {
    const snap = snapshotAfter(boardStores(), [add("a", "x")]);
    expect(() => races(snap, tallyStores())).toThrow(/no store of the factory/);
  });

  test("a factory that returns a store without one of its logged transactions throws", () => {
    const snap = snapshotAfter(boardStores(), [add("a", "x"), rename("a", "y", 0)]);
    const partial = () => () => {
      const { board, add: a } = boardStores()();
      return { board, a };
    };
    expect(() => races(snap, partial())).toThrow(/no transaction t.rename/);
  });

  test("an entry whose base state cannot be rebuilt because initial fails to restore is unchecked folded", () => {
    const snap = snapshotAfter(boardStores(), [add("a", "x"), rename("a", "y", 0)]);
    const broken = { ...snap, initial: { titles: "none" } };
    expect(races(broken, boardStores())).toEqual({
      races: [],
      unchecked: [{ store: "t.board", id: 2, reason: "folded" }],
    });
  });

  test("an entry whose base state cannot be rebuilt because a kept entry fails to replay is unchecked folded", () => {
    const snap = snapshotAfter(boardStores(), [add("a", "x"), add("b", "y"), add("c", "z"), rename("c", "w", 2)]);
    // Replaying `add a x` onto this initial breaks the unique-title invariant.
    const broken = { ...snap, initial: { titles: [{ id: "q", title: "x" }] } };
    expect(races(broken, boardStores())).toEqual({
      races: [],
      unchecked: [{ store: "t.board", id: 4, reason: "folded" }],
    });
  });

  test("when two stores of the factory hold the snapshot, the factory's first is checked", () => {
    const snap = snapshotAfter(boardStores(), [add("a", "x"), rename("a", "y"), add("b", "z"), rename("a", "w", 1)]);
    const Board = s.object({ titles: s.array(s.object({ id: s.string(), title: s.string() })) });
    const Item = s.object({ id: s.string(), title: s.string() });
    const board = (id: string) => {
      const b = store(Board, { titles: [] }, { id });
      const a = transaction(b, "t.add", Item, (st, p) => ({ titles: [...st.titles, p] }), { concurrent: "rebase" });
      const r = transaction(
        b,
        "t.rename",
        Item,
        (st, p) => ({ titles: st.titles.map((x) => (x.id === p.id ? { ...x, title: p.title } : x)) }),
        { concurrent: "rebase" },
      );
      return [b, a, r];
    };
    const twins = (ids: readonly string[]) => () => Object.fromEntries(ids.flatMap(board).map((v, i) => [i, v]));
    expect(races(snap, twins(["t.one", "t.two"])).races.map((r) => r.store)).toEqual(["t.one"]);
    expect(races(snap, twins(["t.two", "t.one"])).races.map((r) => r.store)).toEqual(["t.two"]);
  });

  test("an entry whose base is not below its own id is unchecked folded", () => {
    for (const base of [2, 5]) {
      const snap = snapshotAfter(boardStores(), [add("a", "x"), rename("a", "y", base)]);
      expect(races(snap, boardStores())).toEqual({
        races: [],
        unchecked: [{ store: "t.board", id: 2, reason: "folded" }],
      });
    }
  });
});
