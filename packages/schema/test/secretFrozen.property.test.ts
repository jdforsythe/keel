// k.reveal Purpose: what `reveal` returns is frozen deep when the secret is made; a secret over `s.json()` freezes the
// caller's own object. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { reveal, s } from "../src/index.ts";

const SEED = 1337;
const isObj = (v: unknown): v is object => typeof v === "object" && v !== null;
const reachable = (v: unknown, out: object[] = []): object[] => {
  if (!isObj(v)) return out;
  out.push(v);
  for (const k of Reflect.ownKeys(v)) reachable(Reflect.get(v, k), out);
  return out;
};

describe("Secret.of freezes deep", () => {
  it("leaves nothing reachable from a revealed value writable, for any nested json value", () => {
    const Free = s.secret(s.json());
    fc.assert(
      fc.property(fc.jsonValue({ maxDepth: 4 }), (raw) => {
        const r = Free.parse(raw);
        if (!r.ok) throw new Error("a json value parses");
        for (const o of reachable(reveal(r.value))) {
          expect(Object.isFrozen(o)).toBe(true);
          expect(Reflect.set(o, "added", 1)).toBe(false);
          for (const k of Reflect.ownKeys(o)) expect(Reflect.deleteProperty(o, k)).toBe(false);
        }
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("freezes an object nested in a declared object, and leaves the input's outer object to the caller", () => {
    const Box = s.secret(s.object({ meta: s.json(), list: s.array(s.object({ n: s.int() })) }));
    const meta = { inner: { deep: [1, 2] } };
    const input = { meta, list: [{ n: 1 }] };
    const r = Box.parse(input);
    if (!r.ok) throw new Error("parse");
    const v = reveal(r.value);
    expect(reachable(v).every((o) => Object.isFrozen(o))).toBe(true);
    expect(Object.isFrozen(meta.inner.deep)).toBe(true);
    expect(Object.isFrozen(input)).toBe(false);
  });

  it("freezes a value shared twice once, and ends on a cyclic input", () => {
    const shared = { a: [1] };
    const r = s.secret(s.json()).parse({ x: shared, y: shared });
    expect(r.ok).toBe(true);
    expect(Object.isFrozen(shared.a)).toBe(true);
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(s.secret(s.json()).parse(loop).ok).toBe(false);
  });
});
