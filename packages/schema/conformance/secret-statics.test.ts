// Spec: k.identity, clause "For `v` a parsed `s.secret(s.string())` value, `Object.getOwnPropertyNames(Object.getPrototypeOf(v).constructor)` is `length`, `name` and `prototype` in some order, calling that constructor with `new` throws a value `isDefect(v, 'E1764')` accepts, and no export of `@keel/schema` but `reveal` returns the string."
// Seed 1337.
import * as schema from "@keel/schema";
import { isDefect, reveal, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED } from "./fixtures";

const opts = { seed: SEED, numRuns: RUNS };
const S = s.secret(s.string());
const parsed = (text: string) => {
  const r = S.parse(text);
  if (!r.ok) throw new Error("parse failed");
  return r.value;
};

describe("k.identity: Secret has no static member", () => {
  it("the constructor reached from a parsed secret has exactly length, name and prototype as own names", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (text) => {
        const ctor = Object.getPrototypeOf(parsed(text)).constructor;
        expect(Object.getOwnPropertyNames(ctor).sort()).toEqual(["length", "name", "prototype"]);
        expect(Object.getOwnPropertySymbols(ctor)).toEqual([]);
      }),
      opts,
    );
  });

  it("calling that constructor with new throws a value isDefect(v, 'E1764') accepts", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (text) => {
        const ctor = Object.getPrototypeOf(parsed(text)).constructor;
        let caught: unknown;
        try {
          Reflect.construct(ctor, [text]);
        } catch (e) {
          caught = e;
        }
        expect(isDefect(caught, "E1764")).toBe(true);
      }),
      opts,
    );
  });

  it("no export of @keel/schema but reveal returns the string", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 8 }), (text) => {
        const v = parsed(text);
        expect(reveal(v)).toBe(text);
        for (const [name, fn] of Object.entries(schema)) {
          if (name === "reveal" || typeof fn !== "function") continue;
          let out: unknown;
          try {
            out = Reflect.apply(fn, undefined, [v]);
          } catch {
            continue;
          }
          expect(out).not.toBe(text);
        }
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("spread, JSON.stringify, String(), a template string and structuredClone do not leak the value", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 8 }), (text) => {
        const v = parsed(text);
        expect(JSON.stringify({ ...v })).not.toContain(text);
        expect(JSON.stringify(v)).not.toContain(text);
        expect(String(v)).not.toContain(text);
        expect(`${v}`).not.toContain(text);
        expect(JSON.stringify(structuredClone(v))).not.toContain(text);
      }),
      opts,
    );
  });
});
