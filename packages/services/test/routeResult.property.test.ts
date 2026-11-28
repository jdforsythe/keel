// The route's own `Result` in a k.server answer (k.services Encoding): a GET reads `results[id]` and ignores parent
// levels; an action's answer is the body; anything else is no `Result`. Seed 1337.
import { ok } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { routeResult } from "../src/internal/routeResult.ts";

const SEED = 1337;
const id = fc.stringMatching(/^[a-z]{1,6}\.[a-z]{1,6}$/);

describe("routeResult", () => {
  it("a GET reads its own level's ok or err and ignores the others", () => {
    fc.assert(
      fc.property(id, fc.jsonValue(), fc.anything(), fc.boolean(), (rid, v, parent, good) => {
        const own = good ? { ok: true, value: v } : { ok: false, error: v };
        const body = { id: rid, results: { "p.layout": parent, [rid]: own } };
        expect(routeResult(body, true)).toEqual(good ? ok(v) : { ok: false, error: v });
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("an action's answer is the body itself, as is a GET body without `id`", () => {
    fc.assert(
      fc.property(fc.jsonValue(), fc.boolean(), fc.boolean(), (v, good, get) => {
        const body = good ? { ok: true, value: v } : { ok: false, error: v };
        expect(routeResult(body, get)).toEqual(good ? ok(v) : { ok: false, error: v });
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("a body that is not a Result, or a GET whose own level is missing, is undefined", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(null), fc.integer(), fc.string(), fc.array(fc.integer()), fc.constant({ ok: "yes" })),
        (body) => {
          expect(routeResult(body, false)).toBeUndefined();
          expect(routeResult({ id: "a.b", results: { "a.c": { ok: true, value: 1 } } }, true)).toBeUndefined();
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });
});
