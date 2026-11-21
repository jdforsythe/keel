// k.resume Stores: while islands resume, a store created with the id of a waiting `#k-state` snapshot starts from it.
// A snapshot the store's schema refuses is not taken: it stays waiting, so `resume` warns E1253 for it, and the store
// starts from `initial`.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { afterEach, describe, expect, it } from "vitest";
import { store } from "../src/store.ts";

const WAITING = Symbol.for("keel.waitingSnapshots");
const Count = s.object({ n: s.number() });

const make = (id: string): number => {
  const out = { n: -1 };
  scope(() => {
    out.n = store(Count, { n: 0 }, { id }).get("n");
  }).dispose();
  return out.n;
};
const valid = (n: number): unknown => ({ state: { n }, log: [], initial: { n } });

afterEach(() => {
  Reflect.deleteProperty(globalThis, WAITING);
});

describe("a waiting snapshot", () => {
  it("restores the store of its id and is taken", () => {
    const waiting = new Map<string, unknown>([["ws.valid", valid(5)]]);
    Reflect.set(globalThis, WAITING, waiting);
    expect(make("ws.valid")).toBe(5);
    expect(waiting.has("ws.valid")).toBe(false);
  });

  it("that the store's schema refuses is left waiting and the store starts from initial", () => {
    const waiting = new Map<string, unknown>([["ws.invalid", { state: { n: "five" }, log: [] }]]);
    Reflect.set(globalThis, WAITING, waiting);
    expect(make("ws.invalid")).toBe(0);
    expect(waiting.get("ws.invalid")).toBe(Symbol.for("keel.refusedSnapshot"));
    expect(make("ws.invalid")).toBe(0);
  });
});
