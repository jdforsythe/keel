import { s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { paramsOf } from "../src/server/internal/paramsOf.ts";

const Params = s.object({ room: s.string(), page: s.int() });
const value = fc.record({ room: fc.string(), page: fc.integer() });
const urlOf = (v: { room: string; page: number }, order: boolean) => {
  const q = new URLSearchParams(
    order ? { room: v.room, page: String(v.page) } : { page: String(v.page), room: v.room },
  );
  return `http://x.test/api/e?${q}`;
};

test("params parse from the search in any key order to one instance key; distinct params give distinct keys", () => {
  fc.assert(
    fc.property(value, value, fc.boolean(), (a, b, order) => {
      const ra = paramsOf(Params, urlOf(a, true));
      const ra2 = paramsOf(Params, urlOf(a, order));
      const rb = paramsOf(Params, urlOf(b, true));
      if (!ra.ok || !ra2.ok || !rb.ok) throw new Error("did not parse");
      expect(ra.value.value).toEqual(a);
      expect(ra2.value.key).toBe(ra.value.key);
      expect(rb.value.key === ra.value.key).toBe(a.room === b.room && a.page === b.page);
    }),
    { seed: 1337, numRuns: 200 },
  );
});

test("a search that fails the params schema is an err", () => {
  expect(paramsOf(Params, "http://x.test/e?room=a&page=x").ok).toBe(false);
  expect(paramsOf(Params, "http://x.test/e").ok).toBe(false);
});
