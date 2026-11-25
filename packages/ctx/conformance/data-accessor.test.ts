// Spec: k.data, clause "An app-registered accessor called twice with one sim ctx returns one object, made once; two sim ctxs of one seed get two objects, whose `sim` factories received equal `seed`s, and a write through one is not read through the other."
// fast-check seed: 1337
import { createCtx, register } from "@keel/ctx";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const FC = { seed: 1337, numRuns: 25 };
const never = () => {
  throw new Error("not the ctx's mode");
};

interface NoteStore {
  add(n: string): void;
  all(): readonly string[];
}
const memory = (): NoteStore => {
  const rows: string[] = [];
  return {
    add: (n) => void rows.push(n),
    all: () => [...rows],
  };
};

let counter = 0;
const fresh = (): string => `notes.data${counter++}`;

describe("k.data accessor", () => {
  test("an app-registered accessor called twice with one sim ctx returns one object, made once", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), fc.integer({ min: 2, max: 6 }), (seed, calls) => {
        let made = 0;
        const access = register<NoteStore>(fresh(), {
          real: never,
          shell: never,
          sim: () => {
            made += 1;
            return memory();
          },
        });
        const ctx = createCtx({ mode: "sim", seed });
        const first = access(ctx);
        for (let i = 1; i < calls; i++) expect(access(ctx)).toBe(first);
        expect(made).toBe(1);
      }),
      FC,
    );
  });

  test("two sim ctxs of one seed get two objects, whose `sim` factories received equal `seed`s", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (seed) => {
        const seen: unknown[] = [];
        const access = register<NoteStore>(fresh(), {
          real: never,
          shell: never,
          sim: (opts: { seed: unknown }) => {
            seen.push(opts.seed);
            return memory();
          },
        });
        const a = access(createCtx({ mode: "sim", seed }));
        const b = access(createCtx({ mode: "sim", seed }));
        expect(a).not.toBe(b);
        expect(seen).toHaveLength(2);
        expect(seen[0]).toBeDefined();
        expect(seen[1]).toEqual(seen[0]);
      }),
      FC,
    );
  });

  test("a write through one sim ctx's object is not read through the other's", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), fc.string({ minLength: 1 }), (seed, note) => {
        const access = register<NoteStore>(fresh(), { real: never, shell: never, sim: memory });
        const a = access(createCtx({ mode: "sim", seed }));
        const b = access(createCtx({ mode: "sim", seed }));
        a.add(note);
        expect(a.all()).toEqual([note]);
        expect(b.all()).toEqual([]);
      }),
      FC,
    );
  });
});
