import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { gen } from "../src/gen.ts";
import { type Secret, reveal, s } from "../src/index.ts";
import { onSecret, secretWalk } from "../src/internal/index.ts";
// Seed 1337. `reveal` calls the one listener slot (`onSecret`) with the `Secret` it opens, before it opens it, as
// `secretAccess.of` does with each `Secret` it makes; the listener gets the `Secret`, never its value. `secretWalk`, which
// opens secrets through `secretAccess.open`, calls nothing. With no listener held, `reveal` returns the value.
import { secretAccess } from "../src/internal/secretAccess.ts";

const SEED = 1337;
const clears: (() => void)[] = [];
const clearAll = (): void => {
  for (const clear of clears.splice(0)) clear();
};
afterEach(clearAll);

const secrets: fc.Arbitrary<Secret<unknown>>[] = [
  gen(s.secret(s.string())),
  gen(s.secret(s.int())),
  gen(s.secret(s.object({ key: s.string(), n: s.number(), flag: s.boolean() }))),
  gen(s.secret(s.record(s.string()))),
];

describe("reveal and the listener", () => {
  it("calls the listener with the very Secret it opens, once per reveal", () => {
    for (const secret of secrets) {
      fc.assert(
        fc.property(secret, fc.integer({ min: 1, max: 4 }), (made, times) => {
          const heard: Secret<unknown>[] = [];
          clears.push(onSecret((x) => heard.push(x)));
          for (let i = 0; i < times; i++) {
            reveal(made);
            expect(heard.length).toBe(i + 1);
          }
          expect(heard.every((x) => x === made)).toBe(true);
          clearAll();
        }),
        { seed: SEED, numRuns: 50 },
      );
    }
  });

  it("calls the listener before it returns the value", () => {
    const r = s.secret(s.string()).parse("k-order");
    if (!r.ok) throw new Error("parse failed");
    const order: string[] = [];
    clears.push(onSecret(() => order.push("heard")));
    order.push(reveal(r.value));
    expect(order).toEqual(["heard", "k-order"]);
  });

  it("returns the parsed value, with or without a listener", () => {
    fc.assert(
      fc.property(fc.string(), fc.boolean(), (raw, listen) => {
        if (listen) clears.push(onSecret(() => undefined));
        const r = s.secret(s.string()).parse(raw);
        expect(r.ok).toBe(true);
        if (r.ok) expect(reveal(r.value)).toBe(raw);
        clearAll();
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("secretWalk opens secrets without calling the listener", () => {
    fc.assert(
      fc.property(gen(s.object({ a: s.secret(s.string()), b: s.secret(s.array(s.secret(s.int()))) })), (v) => {
        const heard: Secret<unknown>[] = [];
        clears.push(onSecret((x) => heard.push(x)));
        secretWalk(v);
        expect(heard).toEqual([]);
        clearAll();
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("with the slot cleared, a reveal calls nothing", () => {
    const heard: Secret<unknown>[] = [];
    const r = s.secret(s.string()).parse("k-1");
    if (!r.ok) throw new Error("parse failed");
    onSecret((x) => heard.push(x))();
    expect(reveal(r.value)).toBe("k-1");
    expect(heard).toEqual([]);
  });
});
