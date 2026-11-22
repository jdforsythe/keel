// Spec: k.services, Conformance "To a third-party origin (a ctx no `createApp` bound, and a browser whose document is `https://app.test`), `service({ base: 'https://api.example.com' })` sends: for a GET with no `bearer`, a request with exactly the header `accept: application/json` and credentials `same-origin`, a CORS-simple request; with `bearer` `abc`, exactly `accept` and `authorization: Bearer abc`; for a POST with a body, exactly `accept` and `content-type: application/json`; for an `events` GET, exactly `accept: text/event-stream`. None carries `x-keel` or `x-keel-user`."
// Spec: k.services, Encoding "Any other origin is a third party, declared under `origins.connect` (k.origins) or not, and gets nothing else: a GET with no `bearer` to it is a CORS-simple request."
// Seed: 1337. This file is the ctx no `createApp` bound; the browser document is third-party-headers-browser.test.ts (happy-dom).
// Pending: RFC 0197 is not built (the client sends `x-keel: 1` to every origin). To un-skip: change `test.skip` to `test` in this file once `buildRequest` adds `x-keel` only for a Keel origin.
import { SAFELISTED, SEED, THIRD, client, drain, record, secret, simCtx } from "./third-party-support.ts";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const idArb = fc.stringMatching(/^[a-z0-9]{1,12}$/);
const noteArb = fc.string({ maxLength: 30 });

describe("k.services: a third-party request carries no Keel header", () => {
  test("a GET with no `bearer` sends exactly `accept: application/json`, credentials `same-origin`: a CORS-simple request", async () => {
    await fc.assert(
      fc.asyncProperty(idArb, async (id) => {
        const ctx = simCtx();
        const sent = record(ctx);
        await client().show({ params: { id } }, ctx);
        expect(sent).toHaveLength(1);
        expect(sent[0]?.headers).toEqual({ accept: "application/json" });
        expect(sent[0]?.credentials).toBe("same-origin");
        expect(sent[0]?.redirect).toBe("manual");
        // CORS-simple: every header name is on the CORS safelist, so no preflight
        for (const n of sent[0]?.names ?? []) expect(SAFELISTED).toContain(n);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("with `bearer` `abc`, exactly `accept` and `authorization: Bearer abc`", async () => {
    const ctx = simCtx();
    const sent = record(ctx);
    await client().show({ params: { id: "1" }, bearer: secret("abc") }, ctx);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.headers).toEqual({ accept: "application/json", authorization: "Bearer abc" });
    expect(sent[0]?.credentials).toBe("same-origin");
  });

  test("for a POST with a body, exactly `accept` and `content-type: application/json`", async () => {
    await fc.assert(
      fc.asyncProperty(idArb, noteArb, async (id, note) => {
        const ctx = simCtx();
        const sent = record(ctx);
        await client().save({ params: { id }, body: { note } }, ctx);
        expect(sent).toHaveLength(1);
        expect(sent[0]?.method).toBe("POST");
        expect(sent[0]?.headers).toEqual({ accept: "application/json", "content-type": "application/json" });
        expect(sent[0]?.credentials).toBe("same-origin");
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("for an `events` GET, exactly `accept: text/event-stream`", async () => {
    const ctx = simCtx();
    const sent = record(ctx);
    await drain(client().watch({}, ctx));
    expect(sent).toHaveLength(1);
    expect(sent[0]?.method).toBe("GET");
    expect(sent[0]?.headers).toEqual({ accept: "text/event-stream" });
    expect(sent[0]?.credentials).toBe("same-origin");
  });

  test("none of those requests carries `x-keel` or `x-keel-user`", async () => {
    await fc.assert(
      fc.asyncProperty(idArb, fc.boolean(), async (id, withBearer) => {
        const ctx = simCtx();
        const sent = record(ctx);
        const c = client(THIRD);
        await c.show(withBearer ? { params: { id }, bearer: secret("abc") } : { params: { id } }, ctx);
        await c.save({ params: { id }, body: { note: "n" } }, ctx);
        await drain(c.watch({}, ctx));
        expect(sent).toHaveLength(3);
        for (const r of sent) {
          expect(r.names).not.toContain("x-keel");
          expect(r.names).not.toContain("x-keel-user");
        }
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});
