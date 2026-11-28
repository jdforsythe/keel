// Spec: k.reveal, clause "For every generated secret over an object or array, the revealed value and each object and array under it are frozen."
// k.reveal, Purpose "What `reveal` returns (k.privacy Secrets) is plain data, frozen deep when the secret is made, so it cannot change after a reveal; an inner schema that passes its input through (`s.json()`) leaves the caller's object frozen."
// Seed: 1337.
import { reveal, s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED } from "./fixtures";

const opts = { seed: SEED, numRuns: RUNS };

const Nested = s.secret(
  s.object({
    id: s.int(),
    tags: s.array(s.string()),
    inner: s.object({ items: s.array(s.object({ n: s.int(), deep: s.array(s.string()) })) }),
  }),
);
const List = s.secret(s.array(s.object({ k: s.string(), xs: s.array(s.int()) })));
const Grid = s.secret(s.array(s.array(s.int())));
const Free = s.secret(s.json());

const isObj = (v: unknown): v is object => typeof v === "object" && v !== null;

// Every object and array in the value, the value included.
const containers = (v: unknown, out: object[] = []): object[] => {
  if (!isObj(v)) return out;
  out.push(v);
  for (const k of Reflect.ownKeys(v)) containers(Reflect.get(v, k), out);
  return out;
};

const rawJson = fc.oneof(
  fc.array(fc.jsonValue(), { maxLength: 5 }),
  fc.dictionary(fc.string({ maxLength: 6 }), fc.jsonValue()),
);

describe("k.reveal frozen", () => {
  it("for every generated secret over an object, the revealed value and each object and array under it are frozen", () => {
    fc.assert(
      fc.property(gen(Nested), (raw) => {
        const r = Nested.parse(raw);
        if (!r.ok) throw new Error("generated value must parse");
        const value = reveal(r.value);
        const all = containers(value);
        for (const c of all) expect(Object.isFrozen(c)).toBe(true);
        expect(Reflect.set(value, "k", 1)).toBe(false);
      }),
      opts,
    );
  });

  it("for every generated secret over an array, the revealed value and each object and array under it are frozen", () => {
    fc.assert(
      fc.property(gen(List), gen(Grid), (a, b) => {
        const one = List.parse(a);
        const two = Grid.parse(b);
        if (!one.ok || !two.ok) throw new Error("generated value must parse");
        for (const value of [reveal(one.value), reveal(two.value)]) {
          for (const c of containers(value)) expect(Object.isFrozen(c)).toBe(true);
          expect(Reflect.set(value, "k", 1)).toBe(false);
        }
      }),
      opts,
    );
  });

  it("a secret over s.json() freezes the caller's object, and each object and array under it", () => {
    fc.assert(
      fc.property(rawJson, (raw) => {
        const r = Free.parse(raw);
        if (!r.ok) throw new Error("generated value must parse");
        const value = reveal(r.value);
        for (const c of containers(value)) expect(Object.isFrozen(c)).toBe(true);
        for (const c of containers(raw)) expect(Object.isFrozen(c)).toBe(true);
        if (isObj(value)) expect(Reflect.set(value, "k", 1)).toBe(false);
      }),
      opts,
    );
  });

  it("a secret over a string reveals the parsed string", () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const r = s.secret(s.string()).parse(raw);
        if (!r.ok) throw new Error("generated value must parse");
        expect(reveal(r.value)).toBe(raw);
      }),
      opts,
    );
  });
});
