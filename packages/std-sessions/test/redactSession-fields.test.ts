// @vitest-environment happy-dom
// `redactSession` (std.sessions D3), field by field on a hand-written session: which strings of the base, the events
// and the error become `x` repeated, which an `expose` entry keeps, and what never changes.
// Seed 1337
import { scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { store, transaction } from "@keel/store";
import fc from "fast-check";
import { beforeAll, describe, expect, test } from "vitest";
import { Session } from "../src/Session.schema.ts";
import { redactSession } from "../src/redactSession.ts";

const shop = contract("shop", {
  "shop.item": {
    path: "/items/:itemId",
    params: s.object({ itemId: s.string() }),
    search: s.object({
      q: s.string().optional(),
      itemId: s.string().optional(),
      tab: s.enum(["all", "new"]).optional(),
    }),
  },
  "shop.home": { path: "/" },
});
const routes = manifest(shop, {
  "shop.item": { component: (): Node => document.createElement("main") },
  "shop.home": { component: (): Node => document.createElement("main") },
});

beforeAll(() => {
  scope(() => {
    const state = store(
      s.object({ note: s.string(), owner: s.string(), kind: s.enum(["big", "small"]) }),
      { note: "", owner: "", kind: "big" },
      { id: "shop" },
    );
    transaction(state, "shop.rename", s.object({ note: s.string(), by: s.string() }), (st, p) => ({
      ...st,
      note: p.note,
    }));
  });
});

const error = { code: "shop.full", message: "No room for NOTE", data: { at: "shop.add", who: "OWNER", n: 3 } };
const raw = {
  v: 1,
  id: "s1",
  seed: 3,
  deterministic: true,
  at: 10,
  route: { id: "shop.item", params: { itemId: "FIRSTITEM" }, search: { q: "QUERY", itemId: "SEARCHED", tab: "all" } },
  state: { shop: { note: "NOTE", owner: "OWNER", kind: "big" }, loose: { free: "TEXT", n: 1 } },
  events: [
    { at: 11, kind: "tx", store: "shop", name: "shop.rename", payload: { note: "NEWNOTE", by: "ADA" } },
    { at: 12, kind: "tx", store: "ghost", name: "ghost.do", payload: { t: "FREE", n: 2 } },
    { at: 13, kind: "tx", store: "shop", name: "shop.unknown", payload: { t: "FREE" } },
    { at: 14, kind: "nav", href: "/items/OTHER?itemId=AGAIN&q=FIND&tab=new" },
    { at: 15, kind: "nav", href: "/nowhere/PLACE?q=KEPT" },
    { at: 16, kind: "nav", href: "/" },
    { at: 17, kind: "fire", id: "shop.name", event: { type: "input", value: "TYPED" } },
    { at: 18, kind: "fire", id: "shop.name", event: { type: "keydown", key: "k" } },
    { at: 19, kind: "fire", id: "shop.name", event: { type: "keydown", key: "Enter" } },
    { at: 20, kind: "fire", id: "shop.go", event: { type: "click" } },
    { at: 21, kind: "fire", id: "shop.map", event: { type: "emit", detail: { place: "HOME" } } },
    { at: 22, kind: "resource", id: "shop.items", state: "ready" },
    { at: 23, kind: "net", online: false },
    { at: 24, kind: "error", route: "shop.item", error },
  ],
  error,
  fingerprint: "7f3a9c01d2e4",
};
const parsed = Session.parse(raw);
if (!parsed.ok) throw new Error("the hand-written session parses");
const session = parsed.value;
const hiddenError = {
  code: "shop.full",
  message: "xxxxxxxxxxxxxxxx",
  data: { at: "xxxxxxxx", who: "xxxxx", n: 3 },
};

describe("redactSession with no expose entry", () => {
  test("every recorded string becomes x repeated; ids, enums, numbers, times and the fingerprint stay", () => {
    const out = redactSession(session, { routes, expose: [] });
    expect(Session.encode(out)).toEqual({
      ...raw,
      route: {
        id: "shop.item",
        params: { itemId: "xxxxxxxxx" },
        search: { q: "xxxxx", itemId: "xxxxxxxx", tab: "all" },
      },
      state: { shop: { note: "xxxx", owner: "xxxxx", kind: "big" }, loose: { free: "xxxx", n: 1 } },
      events: [
        { at: 11, kind: "tx", store: "shop", name: "shop.rename", payload: { note: "xxxxxxx", by: "xxx" } },
        { at: 12, kind: "tx", store: "ghost", name: "ghost.do", payload: { t: "xxxx", n: 2 } },
        { at: 13, kind: "tx", store: "shop", name: "shop.unknown", payload: { t: "xxxx" } },
        { at: 14, kind: "nav", href: "/items/xxxxx?itemId=xxxxx&q=xxxx&tab=new" },
        { at: 15, kind: "nav", href: "/nowhere/PLACE?q=KEPT" },
        { at: 16, kind: "nav", href: "/" },
        { at: 17, kind: "fire", id: "shop.name", event: { type: "input", value: "xxxxx" } },
        { at: 18, kind: "fire", id: "shop.name", event: { type: "keydown", key: "x" } },
        { at: 19, kind: "fire", id: "shop.name", event: { type: "keydown", key: "Enter" } },
        { at: 20, kind: "fire", id: "shop.go", event: { type: "click" } },
        { at: 21, kind: "fire", id: "shop.map", event: { type: "emit", detail: { place: "HOME" } } },
        { at: 22, kind: "resource", id: "shop.items", state: "ready" },
        { at: 23, kind: "net", online: false },
        { at: 24, kind: "error", route: "shop.item", error: hiddenError },
      ],
      error: hiddenError,
    });
    expect(Session.parse(Session.encode(out)).ok).toBe(true);
  });

  test("a session with no error keeps null, and the input is not changed", () => {
    const before = JSON.stringify(Session.encode(session));
    const out = redactSession({ ...session, error: null, events: [] }, { routes, expose: [] });
    expect(out.error).toBeNull();
    expect(out.events).toEqual([]);
    expect(JSON.stringify(Session.encode(session))).toBe(before);
  });
});

describe("redactSession with expose entries", () => {
  const exposing = (expose: readonly string[]): Session => redactSession(session, { routes, expose });
  let hidden = session;
  beforeAll(() => {
    hidden = exposing([]);
  });

  test("store:<id>#<path> keeps that path of the base state only", () => {
    const out = exposing(["store:shop#note"]);
    expect(out).toEqual({ ...hidden, state: { ...hidden.state, shop: { note: "NOTE", owner: "xxxxx", kind: "big" } } });
    expect(exposing(["store:loose#free"]).state).toEqual({ ...hidden.state, loose: { free: "TEXT", n: 1 } });
  });

  test("two entries of one target both hold", () => {
    expect(exposing(["store:shop#note", "store:shop#owner"]).state).toEqual({
      ...hidden.state,
      shop: { note: "NOTE", owner: "OWNER", kind: "big" },
    });
  });

  test("route:<id>#params.<path> and #search.<path> each keep their own half, in the base and in a nav", () => {
    const params = exposing(["route:shop.item#params.itemId"]);
    expect(params.route).toEqual({
      id: "shop.item",
      params: { itemId: "FIRSTITEM" },
      search: { q: "xxxxx", itemId: "xxxxxxxx", tab: "all" },
    });
    expect(params.events[3]).toEqual({ at: 14, kind: "nav", href: "/items/OTHER?itemId=xxxxx&q=xxxx&tab=new" });
    const search = exposing(["route:shop.item#search.itemId", "route:shop.item#search.q"]);
    expect(search.route).toEqual({
      id: "shop.item",
      params: { itemId: "xxxxxxxxx" },
      search: { q: "QUERY", itemId: "SEARCHED", tab: "all" },
    });
    expect(search.events[3]).toEqual({ at: 14, kind: "nav", href: "/items/xxxxx?itemId=AGAIN&q=FIND&tab=new" });
    expect(exposing(["route:shop.item#itemId", "route:shop.item#q"])).toEqual(hidden);
  });

  test("tx:<name>#<path> keeps that payload path of that transaction", () => {
    const out = exposing(["tx:shop.rename#note"]);
    expect(out.events[0]).toMatchObject({ payload: { note: "NEWNOTE", by: "xxx" } });
    expect(out.events.slice(1)).toEqual(hidden.events.slice(1));
    expect(exposing(["tx:ghost.do#t"]).events[1]).toMatchObject({ payload: { t: "FREE", n: 2 } });
    expect(exposing(["tx:shop#note", "tx:rename#note", "store:shop.rename#note"]).events).toEqual(hidden.events);
  });

  test("el:<id>#value keeps that element's input values and keys; another path or element does not", () => {
    const out = exposing(["el:shop.name#value"]);
    expect(out.events[6]).toEqual(raw.events[6]);
    expect(out.events[7]).toEqual(raw.events[7]);
    expect(exposing(["el:shop.name#key", "el:shop.other#value", "el:shop.name#values"]).events).toEqual(hidden.events);
  });

  test("error:<code>#data.<path> keeps that data path; the message is never kept", () => {
    const shown = { code: "shop.full", message: "xxxxxxxxxxxxxxxx", data: { at: "xxxxxxxx", who: "OWNER", n: 3 } };
    const out = exposing(["error:shop.full#data.who", "error:shop.full#message"]);
    expect(out.error).toEqual(shown);
    expect(out.events.at(-1)).toEqual({ at: 24, kind: "error", route: "shop.item", error: shown });
    expect(exposing(["error:shop.full#who", "error:shop.other#data.who"]).error).toEqual(hiddenError);
  });

  test("an entry that is no <subject>:<target>#<path> is ignored", () => {
    expect(exposing(["", "store", "store:shop", "store:shop#", "shop#note", "note"])).toEqual(hidden);
  });

  test("property: an exposed store string is kept whatever it is, and its neighbour is not", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Z]{1,12}$/), fc.stringMatching(/^[A-Z]{1,12}$/), (note, owner) => {
        const given = { ...session, state: { shop: { note, owner, kind: "big" } } };
        const out = redactSession(given, { routes, expose: ["store:shop#note"] });
        expect(out.state).toEqual({ shop: { note, owner: "x".repeat(owner.length), kind: "big" } });
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});
