// Spec: k.services, Conformance "From a third party, a 200 body `{ \"ok\": false, \"error\": { \"code\": \"keel.denied\", \"message\": \"x\" } }` against an `output` it fails is `api.decode`; a 403 with that body and no `errors[403]` is `api.status` 403 with `body: null`; neither is `api.network`."
// Spec: k.services, Encoding "a third party's body shaped like one is data (a 2xx one failing `output` is `api.decode`; a non-2xx one, a 502 `keel.unreachable` too, `api.status`)"
// Seed: 1337. A ctx no `createApp` bound, so the origin is a third party. The 502 `keel.unreachable` case is the Encoding sentence's own.
import { s } from "@keel/schema";
import { endpoints, service } from "@keel/services";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, THIRD, json, record, simCtx } from "./third-party-support.ts";

const Out = s.object({ id: s.string() });
const api = service({ base: THIRD, schema: endpoints({ get: { method: "GET", path: "/x", output: Out } }) });
const keelShaped = (code: string, message: string) => ({ ok: false, error: { code, message } });
const messageArb = fc.string({ maxLength: 60 });

describe("k.services: a third party's Keel-shaped body is plain data", () => {
  test("a 200 keel-shaped err body against an `output` it fails is `api.decode`, never `api.network`", async () => {
    await fc.assert(
      fc.asyncProperty(messageArb, async (message) => {
        const ctx = simCtx();
        record(ctx, () => json(keelShaped("keel.denied", message)));
        const r = await api.get({}, ctx);
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.error.code).toBe("api.decode");
          expect(r.error.code).not.toBe("api.network");
        }
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  test("a 403 with that body and no `errors[403]` is `api.status` 403 with `body: null`, never `api.network`", async () => {
    await fc.assert(
      fc.asyncProperty(messageArb, async (message) => {
        const ctx = simCtx();
        record(ctx, () => json(keelShaped("keel.denied", message), 403));
        const r = await api.get({}, ctx);
        expect(r.ok).toBe(false);
        if (!r.ok && r.error.code === "api.status") {
          expect(r.error.data.status).toBe(403);
          expect(r.error.data.body).toBeNull();
        } else {
          expect.unreachable("expected api.status");
        }
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  test("a 502 `keel.unreachable` body from a third party is `api.status` 502, not `api.network`", async () => {
    await fc.assert(
      fc.asyncProperty(messageArb, async (message) => {
        const ctx = simCtx();
        record(ctx, () => json({ ok: false, error: { code: "keel.unreachable", message, data: {} } }, 502));
        const r = await api.get({}, ctx);
        expect(r.ok).toBe(false);
        if (!r.ok && r.error.code === "api.status") expect(r.error.data.status).toBe(502);
        else expect.unreachable("expected api.status");
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});
