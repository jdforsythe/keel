// Property: no client call throws or rejects, whatever the input or the network does. fast-check seed: 1337.
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { endpoints } from "../src/endpoints.ts";
import { service } from "../src/service.ts";

const BASE = "https://api.test";
const CODES = ["api.status", "api.decode", "api.input", "api.timeout", "api.network"];

const api = service({
  base: BASE,
  timeout: 50,
  schema: endpoints({
    send: {
      method: "POST",
      path: "/a/:id",
      params: s.object({ id: s.string() }),
      query: s.object({ q: s.int().optional() }),
      body: s.object({ n: s.number() }),
      output: s.object({ ok: s.boolean() }),
      errors: { 409: s.object({ reason: s.string() }), 422: s.array(s.string()) },
    },
  }),
});

type Behavior =
  | { kind: "respond"; status: number; body: string }
  | { kind: "reject"; message: string }
  | { kind: "throw" }
  | { kind: "stall" };

const behavior: fc.Arbitrary<Behavior> = fc.oneof(
  fc.record({
    kind: fc.constant("respond" as const),
    status: fc.integer({ min: 200, max: 599 }).filter((n) => ![204, 205, 304].includes(n)),
    body: fc.oneof(fc.string(), fc.json(), fc.constant('{"ok":true}'), fc.constant('{"reason":"x"}')),
  }),
  fc.record({ kind: fc.constant("reject" as const), message: fc.string() }),
  fc.constant({ kind: "throw" as const }),
  fc.constant({ kind: "stall" as const }),
);

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe("never throws", () => {
  test("property: any input and any network behavior yields a Result with an api.* code", async () => {
    const input = fc.oneof(
      fc.record({ params: fc.record({ id: fc.fullUnicodeString() }), body: fc.record({ n: fc.double() }) }),
      fc.anything(),
    );
    await fc.assert(
      fc.asyncProperty(input, behavior, async (raw, b) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        ctx.net.route(`${BASE}/*`, (): Response | Promise<Response> => {
          if (b.kind === "respond") return new Response(b.body, { status: b.status });
          if (b.kind === "reject") return Promise.reject(new Error(b.message));
          if (b.kind === "stall") return new Promise<Response>(() => {});
          throw new Error("handler threw");
        });
        const pending: Promise<unknown> = Reflect.apply(api.send, undefined, [raw, ctx]);
        await flush();
        ctx.clock.advance(50);
        const r: unknown = await pending;
        expect(r).toHaveProperty("ok");
        if (typeof r === "object" && r !== null && Reflect.get(r, "ok") === false)
          expect(CODES).toContain(Reflect.get(Reflect.get(r, "error"), "code"));
      }),
      { seed: 1337 },
    );
  });
});
