// k.schema Plain data, the cases beside the conformance list: the Result brand, a non-enumerable index, a cycle and a
// shared container, a revoked Proxy, a getter at a schema with a secret node (judged before `seal` copies it), and
// typed arrays at each position. fast-check seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { err, ok, s } from "../src/index.ts";

const run = { seed: 1337, numRuns: 100 };
type Parsed = ReturnType<ReturnType<typeof s.object>["parse"]>;
const paths = (r: Parsed) => (r.ok ? [] : r.error.data.issues.map((i) => [i.path, i.rule]));

describe("plain data", () => {
  it("a Result from ok or err parses and encodes under s.result: its brand is no key", () => {
    const R = s.result(s.int(), s.error("t.e", s.object({})));
    expect(R.parse(ok(1)).ok).toBe(true);
    expect(R.parse(err({ code: "t.e", message: "t.e", data: {} })).ok).toBe(true);
    expect(R.encode(ok(1))).toEqual({ ok: true, value: 1 });
  });

  it("the brand key enumerable, or holding another value, is a symbol key: refused", () => {
    const brand = Symbol.for("keel.result");
    const O = s.object({});
    expect(paths(O.parse({ x: { [brand]: true } }))).toEqual([[["x"], "type"]]);
    expect(paths(O.parse({ x: Object.defineProperty({}, brand, { value: "data" }) }))).toEqual([[["x"], "type"]]);
  });

  it("an array with a non-enumerable index is not a plain array", () => {
    const a = Object.defineProperty(["v"], "0", { value: "v", enumerable: false });
    expect(paths(s.object({}).parse({ x: a }))).toEqual([[["x"], "type"]]);
    expect(s.array(s.string()).parse(a).ok).toBe(false);
    expect(s.json().parse(a).ok).toBe(false);
  });

  it("an array with a trailing hole is not a plain array", () => {
    const a: unknown[] = ["v"];
    a.length = 2;
    expect(s.array(s.string()).parse(a).ok).toBe(false);
    expect(s.json().parse(a).ok).toBe(false);
  });

  it("a container met inside itself is refused at the path where it is met again", () => {
    const c: Record<string, unknown> = { a: 1 };
    c.self = { back: c };
    expect(paths(s.object({}).parse({ x: c }))).toEqual([[["x", "self", "back"], "type"]]);
    expect(s.json().parse(c).ok).toBe(false);
  });

  it("a declared container met again under an undeclared key fails where it is met again, the declared containers counted as ancestors", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^z[a-z]{0,5}$/), (key) => {
        const a: Record<string, unknown> = {};
        a[key] = a;
        expect(paths(s.object({ a: s.object({}) }).parse({ a }))).toEqual([[["a", key], "type"]]);
        const root: Record<string, unknown> = {};
        root[key] = root;
        expect(paths(s.object({}).parse(root))).toEqual([[[key], "type"]]);
        const b: Record<string, unknown> = { x: {} };
        Object.assign(Object(b.x), { [key]: b });
        expect(paths(s.object({ a: s.object({ x: s.object({}) }) }).parse({ a: b }))).toEqual([
          [["a", "x", key], "type"],
        ]);
        const items: unknown[] = [];
        items.push({ [key]: items });
        expect(paths(s.object({ l: s.array(s.object({})) }).parse({ l: items }))).toEqual([[["l", 0, key], "type"]]);
      }),
      run,
    );
  });

  it("a container held at many paths, not inside itself, is plain data and is walked once", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 40 }), (depth) => {
        // Each level holds the next twice: 2^depth paths, one container per level.
        let v: unknown = { leaf: "v" };
        for (let i = 0; i < depth; i++) v = { a: v, b: [v] };
        expect(s.object({}).parse({ x: v }).ok).toBe(true);
        expect(s.json().parse(v).ok).toBe(true);
      }),
      run,
    );
  });

  it("a value that is not plain data, held at two paths, is reported at each", () => {
    const bad = new Map();
    expect(paths(s.object({}).parse({ x: { a: bad, b: bad } }))).toEqual([
      [["x", "a"], "type"],
      [["x", "b"], "type"],
    ]);
  });

  it("a revoked Proxy fails parse with rule type at the root and never throws", () => {
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    for (const S of [s.object({}), s.array(s.int()), s.json(), s.object({ k: s.secret(s.string()) })]) {
      const r = S.parse(proxy);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.data.issues).toEqual([{ path: [], rule: "type" }]);
    }
  });

  it("a getter at a schema with a secret node is refused before the seal copies the input, and never runs", () => {
    let runs = 0;
    const input = Object.defineProperty({ k: "raw" }, "g", {
      enumerable: true,
      get: () => {
        runs++;
        return "v";
      },
    });
    const S = s.object({ k: s.secret(s.string()) });
    expect(paths(S.parse({ ...{ k: "raw" }, x: input }))).toEqual([[["x"], "type"]]);
    expect(paths(S.parse(input))).toEqual([[[], "type"]]);
    expect(runs).toBe(0);
  });

  it("a typed array is refused at an array, object, record and json node and under an undeclared key", () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 4 }), (bytes) => {
        const O = s.object({
          l: s.array(s.int()).optional(),
          o: s.object({}).optional(),
          r: s.record(s.int()).optional(),
        });
        expect(paths(O.parse({ l: bytes }))).toEqual([[["l"], "type"]]);
        expect(paths(O.parse({ o: bytes }))).toEqual([[["o"], "type"]]);
        expect(paths(O.parse({ r: bytes }))).toEqual([[["r"], "type"]]);
        expect(paths(O.parse({ z: bytes }))).toEqual([[["z"], "type"]]);
        expect(s.json().parse(bytes).ok).toBe(false);
      }),
      run,
    );
  });

  it("a non-plain value at a declared object position is one issue at its path, nothing under it read", () => {
    const S = s.object({ a: s.object({ n: s.int() }) });
    expect(paths(S.parse({ a: new Map([["n", "x"]]) }))).toEqual([[["a"], "type"]]);
    expect(paths(S.parse({ a: Object.assign(Object.create({}), { n: "x" }) }))).toEqual([[["a"], "type"]]);
  });
});
