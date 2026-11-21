// Spec: k.services API, "A call reads at most `maxBytes` (a `service` option, default 1 MiB) of a response body; a longer 2xx body is `api.decode`, another `api.status` with `body` `null`."
// Seed 1337 (fc.assert below). Sim net only; a `base` service over one GET endpoint with a declared 409 error schema.
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { endpoints, service } from "@keel/services";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const BASE = "https://api.example.com";
const MIB = 1024 * 1024;
const Out = s.object({ t: s.string() });
const schema = endpoints({
  get: { method: "GET", path: "/x", output: Out, errors: { 409: s.object({ t: s.string() }) } },
});
// A JSON object `{"t":"aaa..."}` of exactly `bytes` bytes.
const bodyOf = (bytes: number): string => `{"t":"${"a".repeat(bytes - 8)}"}`;
type Run = Awaited<ReturnType<typeof run>>;
/** The `api.status` body of a failed result; throws when the result is not an `api.status` err. */
const statusBody = (r: Run): unknown => {
  if (r.ok || r.error.code !== "api.status") throw new Error("expected api.status");
  return r.error.data.body;
};
const run = async (maxBytes: number | undefined, status: number, body: string) => {
  const api = service(maxBytes === undefined ? { base: BASE, schema } : { base: BASE, schema, maxBytes });
  const ctx = createCtx({ mode: "sim", seed: SEED });
  ctx.net.route(`${BASE}/x`, () => new Response(body, { status, headers: { "content-type": "application/json" } }));
  return api.get({}, ctx);
};

describe("k.services: maxBytes", () => {
  it("with no `maxBytes`, a 2xx body of 1 MiB is read and decoded", async () => {
    const r = await run(undefined, 200, bodyOf(MIB));
    expect(r.ok).toBe(true);
  });

  it("with no `maxBytes`, a 2xx body over 1 MiB is `api.decode`", async () => {
    const r = await run(undefined, 200, bodyOf(MIB + 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("api.decode");
  });

  it("with no `maxBytes`, a non-2xx body over 1 MiB is `api.status` with `body` null, though `errors` declares the status", async () => {
    const r = await run(undefined, 409, bodyOf(MIB + 1));
    expect(statusBody(r)).toBeNull();
  });

  it("for any `maxBytes`, a 2xx body of exactly that size decodes and one byte more is `api.decode`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 16, max: 4096 }), async (max) => {
        const within = await run(max, 200, bodyOf(max));
        expect(within.ok).toBe(true);
        const over = await run(max, 200, bodyOf(max + 1));
        expect(over.ok).toBe(false);
        if (!over.ok) expect(over.error.code).toBe("api.decode");
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("for any `maxBytes`, a non-2xx body over it is `api.status` with `body` null, and one within it is decoded by `errors`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 16, max: 4096 }), async (max) => {
        const over = await run(max, 409, bodyOf(max + 1));
        expect(statusBody(over)).toBeNull();
        const within = await run(max, 409, bodyOf(max));
        expect(statusBody(within)).toEqual({ t: "a".repeat(max - 8) });
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});
