import { s } from "@keel/schema";
// @vitest-environment happy-dom
// Small parts with one job each: merging a replay's observations with the recorded inputs, the values a recorder
// must treat as already redacted, where an upload may go, the mask of a value with no schema, the seeded stream, a
// field read off an unknown value, and the messages a group and its workers exchange.
// Seed 1337
import fc from "fast-check";
import { afterEach, describe, expect, test } from "vitest";
import type { SessionEvent } from "../../src/SessionEvent.ts";
import { field } from "../../src/group/internal/field.ts";
import { wire } from "../../src/group/internal/wire.ts";
import { currentValues } from "../../src/internal/currentValues.ts";
import { jsonOf } from "../../src/internal/jsonOf.ts";
import { mask } from "../../src/internal/mask.ts";
import { mergeInputs } from "../../src/internal/mergeInputs.ts";
import { seeded } from "../../src/internal/seeded.ts";
import { uploadable } from "../../src/internal/uploadable.ts";
import { utf8Length } from "../../src/internal/utf8Length.ts";

const fire = (at: number, id: string): SessionEvent => ({ at, kind: "fire", id, event: { type: "click" } });
const nav = (at: number, href: string): SessionEvent => ({ at, kind: "nav", href });
const net = (at: number, online: boolean): SessionEvent => ({ at, kind: "net", online });
const txe = (at: number, name: string): SessionEvent => ({ at, kind: "tx", store: "s", name, payload: null });
const res = (at: number, id: string): SessionEvent => ({ at, kind: "resource", id, state: "ready" });

describe("mergeInputs", () => {
  test("when the replay recorded as many inputs, each takes the recorded one's place in the replay's order", () => {
    const inputs = [fire(1, "recorded.a"), nav(2, "/recorded"), net(3, false)];
    const replayed = [
      fire(10, "replayed.a"),
      txe(10, "t1"),
      nav(20, "/replayed"),
      res(21, "r"),
      net(30, true),
      txe(31, "t2"),
    ];
    expect(mergeInputs(inputs, replayed)).toEqual([
      fire(1, "recorded.a"),
      txe(10, "t1"),
      nav(2, "/recorded"),
      res(21, "r"),
      net(3, false),
      txe(31, "t2"),
    ]);
  });

  test("with no input on either side the observations come back as they were", () => {
    const replayed = [txe(1, "a"), res(2, "b")];
    expect(mergeInputs([], replayed)).toEqual(replayed);
    expect(mergeInputs([], [])).toEqual([]);
  });

  test("when the counts differ, the recorded inputs and the replay's observations are ordered by time", () => {
    const inputs = [fire(5, "a"), fire(20, "b")];
    const replayed = [fire(99, "dropped"), txe(1, "early"), txe(10, "mid"), txe(30, "late")];
    expect(mergeInputs(inputs, replayed)).toEqual([
      txe(1, "early"),
      fire(5, "a"),
      txe(10, "mid"),
      fire(20, "b"),
      txe(30, "late"),
    ]);
    expect(mergeInputs([fire(5, "a")], [])).toEqual([fire(5, "a")]);
    expect(mergeInputs([], [fire(1, "dropped"), txe(2, "kept")])).toEqual([txe(2, "kept")]);
  });

  test("at one time an input goes before an observation, and each side keeps its own order", () => {
    const inputs = [fire(5, "i1"), fire(5, "i2"), fire(5, "i3")];
    const replayed = [txe(5, "o1"), txe(5, "o2"), txe(5, "o3"), txe(4, "before")];
    expect(mergeInputs(inputs, replayed)).toEqual([
      txe(4, "before"),
      fire(5, "i1"),
      fire(5, "i2"),
      fire(5, "i3"),
      txe(5, "o1"),
      txe(5, "o2"),
      txe(5, "o3"),
    ]);
    const many = Array.from({ length: 12 }, (_, i) => fire(7, `i${i}`));
    const seen = Array.from({ length: 12 }, (_, i) => txe(7, `o${i}`));
    expect(mergeInputs(many, seen)).toEqual([...many, ...seen]);
  });

  test("property: every recorded input and every observation of the replay is in the merge, once", () => {
    const input = fc.tuple(fc.nat(50), fc.stringMatching(/^[a-z]{1,4}$/)).map(([at, id]) => fire(at, id));
    const observed = fc.tuple(fc.nat(50), fc.stringMatching(/^[a-z]{1,4}$/)).map(([at, name]) => txe(at, name));
    fc.assert(
      fc.property(
        fc.array(input, { maxLength: 8 }),
        fc.array(fc.oneof(input, observed), { maxLength: 12 }),
        (inputs, replayed) => {
          const merged = mergeInputs(inputs, replayed);
          const observations = replayed.filter((e) => e.kind === "tx");
          expect(merged.filter((e) => e.kind === "fire")).toEqual(
            replayed.length - observations.length === inputs.length ? inputs : [...inputs].sort((a, b) => a.at - b.at),
          );
          expect(merged).toHaveLength(inputs.length + observations.length);
          for (const o of observations) expect(merged).toContain(o);
        },
      ),
      { seed: 1337, numRuns: 100 },
    );
  });
});

describe("currentValues", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("the value of each named control, found by id or by data-k, itself or the first control inside it", () => {
    document.body.innerHTML = `
      <input id="by.id" value="one">
      <div id="wrapper"><span>label</span><textarea>two</textarea><input value="not this"></div>
      <label data-k="by.key"><select><option value="three" selected>3</option></select></label>
      <input data-k="direct.key" value="four">
      <input id="unnamed" value="left alone">`;
    expect(currentValues(["by.id", "wrapper", "by.key", "direct.key"])).toEqual({
      values: ["one", "two", "three", "four"],
      complete: true,
    });
    expect(currentValues([])).toEqual({ values: [], complete: true });
  });

  test("an element that is missing, or holds no control, makes the answer incomplete", () => {
    document.body.innerHTML = '<div id="empty"><span>text</span></div><input id="there" value="v">';
    expect(currentValues(["gone"])).toEqual({ values: [], complete: false });
    expect(currentValues(["empty"])).toEqual({ values: [], complete: false });
    expect(currentValues(["there", "gone", "there"])).toEqual({ values: ["v", "v"], complete: false });
  });

  test("every password field counts, named or not: by type or by autocomplete", () => {
    document.body.innerHTML = `
      <input type="password" value="p1">
      <input type="text" autocomplete="current-password" value="p2">
      <textarea autocomplete="new-password">p3</textarea>
      <div autocomplete="new-password">not a control</div>
      <input type="text" autocomplete="username" value="not a secret">
      <input id="named" value="n1">`;
    expect(currentValues(["named"])).toEqual({ values: ["n1", "p1", "p2", "p3"], complete: true });
    expect(currentValues([])).toEqual({ values: ["p1", "p2", "p3"], complete: true });
  });

  test("an id wins over a data-k of the same name", () => {
    document.body.innerHTML = '<input data-k="same" value="by key"><input id="same" value="by id">';
    expect(currentValues(["same"]).values).toEqual(["by id"]);
  });
});

describe("uploadable", () => {
  const ok = (url: string, page: string): boolean => uploadable(new URL(url), page);

  test("http or https on the page's own origin, with no user name or password", () => {
    expect(ok("https://app.test/sessions", "https://app.test")).toBe(true);
    expect(ok("http://localhost:4200/sessions?x=1", "http://localhost:4200")).toBe(true);
  });

  test("another origin, scheme or port is refused", () => {
    expect(ok("https://other.test/sessions", "https://app.test")).toBe(false);
    expect(ok("http://app.test/sessions", "https://app.test")).toBe(false);
    expect(ok("https://app.test:8443/sessions", "https://app.test")).toBe(false);
  });

  test("a user name or a password in the url is refused, either alone", () => {
    expect(ok("https://user@app.test/sessions", "https://app.test")).toBe(false);
    expect(ok("https://:pw@app.test/sessions", "https://app.test")).toBe(false);
    expect(ok("https://user:pw@app.test/sessions", "https://app.test")).toBe(false);
  });

  test("an opaque page origin, or a url that is not http(s), is refused even when the origins read alike", () => {
    expect(ok("file:///tmp/sessions", "null")).toBe(false);
    expect(ok("data:text/plain,x", "null")).toBe(false);
    expect(ok("blob:https://app.test/1", "https://app.test")).toBe(false);
    expect(ok("ws://app.test/sessions", "ws://app.test")).toBe(false);
    expect(ok("ftp://app.test/sessions", "ftp://app.test")).toBe(false);
  });
});

describe("mask, jsonOf, utf8Length, seeded", () => {
  test("mask: a string is x repeated, a number 0, a boolean false, anything else null", () => {
    expect(mask("secret")).toBe("xxxxxx");
    expect(mask("")).toBe("");
    expect(mask(42)).toBe(0);
    expect(mask(true)).toBe(false);
    expect(mask(null)).toBeNull();
    expect(mask({ a: "b" })).toBeNull();
    expect(mask(["a"])).toBeNull();
  });

  test("jsonOf: encoded by the schema when given (null when it does not encode), else the value when it is plain data, else null", () => {
    const Pay = s.object({ pin: s.secret(s.string()), n: s.int() });
    const parsed = Pay.parse({ pin: "1234", n: 1 });
    if (!parsed.ok) throw new Error("the fixture parses");
    expect(jsonOf(parsed.value, Pay)).toEqual(Pay.encode(parsed.value));
    expect(jsonOf({ a: [1, "b", null] })).toEqual({ a: [1, "b", null] });
    expect(jsonOf({ a: 1 }, s.string())).toBeNull();
    expect(jsonOf({ a: 1, extra: "x" }, s.object({ a: s.int() }))).toEqual({ a: 1 });
    expect(jsonOf(undefined)).toBeNull();
    expect(jsonOf(() => 1)).toBeNull();
    expect(jsonOf({ big: 1n })).toBeNull();
    expect(jsonOf(Symbol("x"), s.string())).toBeNull();
  });

  test("utf8Length counts bytes, not characters", () => {
    expect(utf8Length("")).toBe(0);
    expect(utf8Length("abc")).toBe(3);
    expect(utf8Length("é")).toBe(2);
    expect(utf8Length("€")).toBe(3);
    expect(utf8Length("😀")).toBe(4);
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(utf8Length(text)).toBe(new TextEncoder().encode(text).length);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });

  test("seeded: the same parts give the same stream in [0, 1); other parts, or their order or split, another", () => {
    const take = (...parts: (string | number)[]): number[] => {
      const next = seeded(...parts);
      return [next(), next(), next(), next()];
    };
    expect(take(7, "tx:a", "b")).toEqual(take(7, "tx:a", "b"));
    for (const x of take(7, "tx:a", "b")) expect(x >= 0 && x < 1).toBe(true);
    expect(new Set(take(7, "tx:a", "b")).size).toBe(4);
    expect(take(8, "tx:a", "b")).not.toEqual(take(7, "tx:a", "b"));
    expect(take(7, "tx:a", "c")).not.toEqual(take(7, "tx:a", "b"));
    expect(take(7, "b", "tx:a")).not.toEqual(take(7, "tx:a", "b"));
    expect(take(7, "tx:ab")).not.toEqual(take(7, "tx:a", "b"));
    // The stream is part of what makes a redacted session byte-equal from run to run: these are its first values.
    expect(take(7, "tx:a", "b")).toEqual([
      0.8959476253949106, 0.1611304555553943, 0.6114238773006946, 0.9438899159431458,
    ]);
  });
});

describe("field", () => {
  test("a property of an object that has it, own or inherited; undefined for anything else", () => {
    expect(field({ t: "ready" }, "t")).toBe("ready");
    expect(field({ t: undefined }, "t")).toBeUndefined();
    expect(field({ t: null }, "t")).toBeNull();
    expect(field([1, 2], "length")).toBe(2);
    expect(field({}, "t")).toBeUndefined();
    expect(field(null, "t")).toBeUndefined();
    expect(field(undefined, "t")).toBeUndefined();
    expect(field("text", "length")).toBeUndefined();
    expect(field(5, "toFixed")).toBeUndefined();
    expect(field(() => 1, "name")).toBeUndefined();
  });
});

describe("wire: the messages between a group and its workers", () => {
  const ok = (schema: { parse(x: unknown): { ok: boolean } }, value: unknown): boolean => schema.parse(value).ok;

  test("ret: an answer to a call, with an optional error code and message", () => {
    expect(ok(wire.ret, { t: "ret", id: 1, ok: true, value: { a: 1 } })).toBe(true);
    expect(ok(wire.ret, { t: "ret", id: 1, ok: false, value: null, code: "x.y", message: "m" })).toBe(true);
    expect(ok(wire.ret, { t: "call", id: 1, ok: true, value: null })).toBe(false);
    expect(ok(wire.ret, { t: "ret", id: "1", ok: true, value: null })).toBe(false);
    expect(ok(wire.ret, { t: "ret", id: 1, value: null })).toBe(false);
    expect(ok(wire.ret, { t: "ret", id: 1, ok: true })).toBe(false);
    expect(ok(wire.ret, { t: "ret", id: 1, ok: true, value: null, code: 5 })).toBe(false);
    expect(ok(wire.ret, {})).toBe(false);
  });

  test("req, head, cancel and end: a request and the parts of its response", () => {
    const req = { t: "req", rid: 1, method: "POST", url: "http://a.test/x", headers: [["accept", "*/*"]] };
    expect(ok(wire.req, req)).toBe(true);
    expect(ok(wire.req, { ...req, headers: [] })).toBe(true);
    expect(ok(wire.req, { ...req, t: "head" })).toBe(false);
    expect(ok(wire.req, { ...req, headers: { accept: "*/*" } })).toBe(false);
    expect(ok(wire.req, { ...req, headers: [["accept", 5]] })).toBe(false);
    expect(ok(wire.req, { ...req, method: undefined })).toBe(false);
    expect(ok(wire.req, {})).toBe(false);
    const head = { t: "head", rid: 1, status: 200, statusText: "OK", headers: [["content-type", "text/plain"]] };
    expect(ok(wire.head, head)).toBe(true);
    expect(ok(wire.head, { ...head, t: "req" })).toBe(false);
    expect(ok(wire.head, { ...head, status: "200" })).toBe(false);
    expect(ok(wire.head, { ...head, headers: "none" })).toBe(false);
    expect(ok(wire.head, {})).toBe(false);
    expect(ok(wire.cancel, { t: "cancel", rid: 3 })).toBe(true);
    expect(ok(wire.cancel, { t: "end", rid: 3 })).toBe(false);
    expect(ok(wire.cancel, { t: "cancel" })).toBe(false);
    expect(ok(wire.end, { t: "end", rid: 3 })).toBe(true);
    expect(ok(wire.end, { t: "end", rid: 3, error: "reset" })).toBe(true);
    expect(ok(wire.end, { t: "cancel", rid: 3 })).toBe(false);
    expect(ok(wire.end, { t: "end", rid: 3, error: 5 })).toBe(false);
    expect(ok(wire.end, {})).toBe(false);
  });

  test("call: an op and its JSON argument", () => {
    expect(ok(wire.call, { t: "call", id: 2, op: "fire", arg: { id: "a" } })).toBe(true);
    expect(ok(wire.call, { t: "ret", id: 2, op: "fire", arg: null })).toBe(false);
    expect(ok(wire.call, { t: "call", id: 2, op: 5, arg: null })).toBe(false);
    expect(ok(wire.call, { t: "call", id: 2, op: "fire" })).toBe(false);
    expect(ok(wire.call, {})).toBe(false);
  });

  test("found and state: what find and state answer", () => {
    const found = { id: "a", role: "button", name: "Add", text: "Add", state: { disabled: true } };
    expect(ok(wire.found, found)).toBe(true);
    expect(ok(wire.found, { ...found, state: {} })).toBe(true);
    for (const flag of ["checked", "disabled", "expanded", "selected", "invalid", "focused"]) {
      expect(ok(wire.found, { ...found, state: { [flag]: false } }), flag).toBe(true);
      expect(ok(wire.found, { ...found, state: { [flag]: "yes" } }), flag).toBe(false);
    }
    for (const key of ["id", "role", "name", "text", "state"])
      expect(ok(wire.found, Object.fromEntries(Object.entries(found).filter(([k]) => k !== key))), key).toBe(false);
    expect(ok(wire.state, { cart: { items: [] }, n: 1 })).toBe(true);
    expect(ok(wire.state, [])).toBe(false);
    expect(ok(wire.state, "state")).toBe(false);
  });

  test("session and replay: a user's session and its replay result", () => {
    const session = {
      v: 1,
      id: "s1",
      deterministic: false,
      at: 0,
      route: { id: "a", params: {}, search: {} },
      state: {},
      events: [],
      error: null,
      fingerprint: "",
    };
    expect(ok(wire.session, session)).toBe(true);
    expect(ok(wire.session, { ...session, v: 2 })).toBe(false);
    const replay = { observed: [nav(1, "/")], state: { a: 1 }, error: null, reproduced: true, unapplied: null };
    expect(ok(wire.replay, replay)).toBe(true);
    expect(ok(wire.replay, { ...replay, unapplied: 3, error: { code: "c", message: "m", data: null } })).toBe(true);
    expect(ok(wire.replay, { ...replay, error: { code: "c", message: "m", data: null, extra: 1 } })).toBe(false);
    expect(ok(wire.replay, { ...replay, error: { code: "c" } })).toBe(false);
    expect(ok(wire.replay, { ...replay, observed: [{ at: 1, kind: "nav" }] })).toBe(false);
    expect(ok(wire.replay, { ...replay, state: [] })).toBe(false);
    expect(ok(wire.replay, { ...replay, reproduced: "yes" })).toBe(false);
    expect(ok(wire.replay, { ...replay, unapplied: "3" })).toBe(false);
    for (const key of Object.keys(replay))
      expect(ok(wire.replay, Object.fromEntries(Object.entries(replay).filter(([k]) => k !== key))), key).toBe(false);
  });

  test("snapshot: a server store as stored, its log entries with optional meta, base and key", () => {
    const entry = { id: 1, name: "a.b", payload: { x: 1 }, at: 5 };
    const snapshot = { state: { n: 1 }, log: [entry], initial: { n: 0 }, head: 1 };
    expect(ok(wire.snapshot, snapshot)).toBe(true);
    expect(ok(wire.snapshot, { ...snapshot, log: [] })).toBe(true);
    expect(ok(wire.snapshot, { ...snapshot, keys: [{ name: "a.b", key: "k1" }] })).toBe(true);
    expect(ok(wire.snapshot, { ...snapshot, log: [{ ...entry, meta: { by: "u" }, base: 0, key: "k1" }] })).toBe(true);
    expect(ok(wire.snapshot, { ...snapshot, keys: [{ name: "a.b" }] })).toBe(false);
    expect(ok(wire.snapshot, { ...snapshot, keys: [{ key: "k1" }] })).toBe(false);
    expect(ok(wire.snapshot, { ...snapshot, keys: "none" })).toBe(false);
    expect(ok(wire.snapshot, { ...snapshot, head: "1" })).toBe(false);
    expect(ok(wire.snapshot, { ...snapshot, log: [{ ...entry, meta: "m" }] })).toBe(false);
    expect(ok(wire.snapshot, { ...snapshot, log: [{ ...entry, base: "0" }] })).toBe(false);
    expect(ok(wire.snapshot, { ...snapshot, log: [{ ...entry, key: 1 }] })).toBe(false);
    expect(ok(wire.snapshot, { ...snapshot, log: {} })).toBe(false);
    for (const key of Object.keys(entry))
      expect(
        ok(wire.snapshot, { ...snapshot, log: [Object.fromEntries(Object.entries(entry).filter(([k]) => k !== key))] }),
        key,
      ).toBe(false);
    for (const key of Object.keys(snapshot))
      expect(ok(wire.snapshot, Object.fromEntries(Object.entries(snapshot).filter(([k]) => k !== key))), key).toBe(
        false,
      );
  });
});
