// k.reveal Purpose: what `reveal` returns is frozen deep when the secret is made; a secret over `s.json()` freezes the
// caller's own object. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Secret } from "../src/Secret.ts";
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

describe("a secret schema's parse on values the freeze cannot walk", () => {
  const K = s.object({ k: s.secret(s.string()) });
  const J = s.object({ k: s.secret(s.json()) });
  const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "ok" : r.error?.code);

  it("returns an err for a typed array, and leaves it unfrozen", () => {
    const bytes = new Uint8Array(4);
    expect(code(K.parse({ k: bytes }))).toBe("schema.invalid");
    expect(code(J.parse({ k: bytes }))).toBe("schema.invalid");
    expect(Object.isFrozen(bytes)).toBe(false);
  });

  it("returns an err for a getter that throws, without a throw", () => {
    const boom = {
      get x(): never {
        throw new Error("boom");
      },
    };
    expect(code(K.parse({ k: boom }))).toBe("schema.invalid");
    expect(code(J.parse({ k: boom }))).toBe("schema.invalid");
    expect(Object.isFrozen(boom)).toBe(false);
  });

  it("returns an err for a revoked Proxy", () => {
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    expect(code(K.parse({ k: proxy }))).toBe("schema.invalid");
    expect(code(J.parse({ k: proxy }))).toBe("schema.invalid");
    expect(code(J.parse(proxy))).toBe("schema.invalid");
  });

  it("leaves the caller's object unfrozen when the parse fails", () => {
    const victim = { arr: [1] };
    expect(code(s.object({ k: s.secret(s.string()) }).parse({ k: victim }))).toBe("schema.invalid");
    expect(code(s.object({ k: s.secret(s.json()), n: s.int() }).parse({ k: victim, n: "x" }))).toBe("schema.invalid");
    expect(Object.isFrozen(victim)).toBe(false);
    expect(Object.isFrozen(victim.arr)).toBe(false);
  });

  it("for any value: never throws; on ok the revealed values are frozen deep; on err no input object's frozen state changes", () => {
    const schemas = [
      s.secret(s.json()),
      s.object({ k: s.secret(s.json()), n: s.int() }),
      s.array(s.secret(s.object({ a: s.array(s.int()) }))),
      s.object({ k: s.secret(s.string()) }),
    ];
    fc.assert(
      fc.property(fc.nat(schemas.length - 1), fc.anything({ withTypedArray: true, withMap: true }), (i, raw) => {
        const schema = schemas[i] ?? schemas[0];
        if (schema === undefined) return;
        const before = reachable(raw).map((o) => Object.isFrozen(o));
        const r = schema.parse(raw);
        if (r.ok) {
          for (const sec of reachable(r.value).filter((o) => Secret.is(o)))
            for (const o of reachable(Secret.open(sec))) expect(Object.isFrozen(o)).toBe(true);
        } else expect(reachable(raw).map((o) => Object.isFrozen(o))).toEqual(before);
      }),
      { seed: SEED, numRuns: 300 },
    );
  });
});
