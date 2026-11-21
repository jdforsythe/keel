// Properties for request encoding. fast-check seed: 1337.
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { endpoints } from "../src/endpoints.ts";
import { encodeQuery } from "../src/internal/encodeQuery.ts";
import { fillPath } from "../src/internal/fillPath.ts";
import { service } from "../src/service.ts";

const FC = { seed: 1337 };
const BASE = "https://api.test";
/** -0 and 0 are one number on the wire. */
const norm = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

const Query = s.object({
  name: s.string({ max: 8 }),
  nick: s.string({ min: 1, max: 8 }).optional(),
  note: s.string({ min: 1 }).nullable(),
  age: s.int(),
  score: s.number(),
  admin: s.boolean(),
  role: s.enum(["admin", "member"]),
  page: s.object({ size: s.int({ min: 1, max: 100 }), cursor: s.string() }),
});

describe("encoding", () => {
  test("property: query encoded to URLSearchParams then decodeStrings returns an equal value", () => {
    fc.assert(
      fc.property(gen(Query), (v) => {
        const r = Query.decodeStrings(encodeQuery(Query.encode(v)));
        expect(r.ok && norm(r.value)).toEqual(norm(v));
      }),
      FC,
    );
  });

  test("property: every path param segment decodes back to its value and contains no '/'", () => {
    fc.assert(
      fc.property(fc.fullUnicodeString({ minLength: 1 }), fc.fullUnicodeString({ minLength: 1 }), (a, b) => {
        fc.pre(![a, b].includes(".") && ![a, b].includes(".."));
        const r = fillPath("/x/:a/y/:b", { a, b });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const [, x, sa, y, sb] = r.value.split("/");
        expect([x, y]).toEqual(["x", "y"]);
        expect([decodeURIComponent(sa ?? ""), decodeURIComponent(sb ?? "")]).toEqual([a, b]);
      }),
      FC,
    );
  });

  test("property: query, params and body sent through sim net round-trip to the handler", async () => {
    const Body = s.object({ title: s.string(), n: s.int(), tags: s.array(s.string()), at: s.number().nullable() });
    const api = service({
      base: BASE,
      schema: endpoints({
        put: {
          method: "PUT",
          path: "/items/:id",
          params: s.object({ id: s.string({ min: 1 }) }),
          query: Query,
          body: Body,
          output: s.object({ id: s.string(), body: Body }),
        },
      }),
    });
    await fc.assert(
      fc.asyncProperty(fc.fullUnicodeString({ minLength: 1 }), gen(Query), gen(Body), async (id, query, body) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        let seen: unknown = null;
        ctx.net.route(`${BASE}/items/*`, async (req) => {
          const url = new URL(req.url);
          seen = Query.decodeStrings(url.searchParams);
          const segment = decodeURIComponent(url.pathname.slice("/items/".length));
          return new Response(JSON.stringify({ id: segment, body: await req.json() }), { status: 200 });
        });
        const r = await api.put({ params: { id }, query, body }, ctx);
        expect(norm(seen)).toEqual(norm({ ok: true, value: query }));
        expect(r.ok && norm(r.value)).toEqual(norm({ id, body }));
      }),
      { ...FC, numRuns: 50 },
    );
  });
});
