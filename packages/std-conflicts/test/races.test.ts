import { races } from "@keel/std-conflicts";
import { describe, expect, test } from "vitest";
import { boardStores, snapshotAfter, tallyStores } from "./helpers.ts";

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
});
