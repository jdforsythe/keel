// @vitest-environment happy-dom
// Spec: k.services, Conformance "To a third-party origin (a ctx no `createApp` bound, and a browser whose document is `https://app.test`), `service({ base: 'https://api.example.com' })` sends: for a GET with no `bearer`, a request with exactly the header `accept: application/json` and credentials `same-origin`, a CORS-simple request; with `bearer` `abc`, exactly `accept` and `authorization: Bearer abc`; for a POST with a body, exactly `accept` and `content-type: application/json`; for an `events` GET, exactly `accept: text/event-stream`. None carries `x-keel` or `x-keel-user`."
// Seed: 1337. The browser half of the clause: the document is `https://app.test` (happy-dom `setURL`), the ctx is a sim ctx no `createApp` bound.
// Pending: RFC 0197 is not built. To un-skip: change `test.skip` to `test` in this file once `buildRequest` adds `x-keel` only for a Keel origin.
import { SAFELISTED, SEED, client, drain, record, secret, simCtx } from "./third-party-support.ts";
import fc from "fast-check";
import { beforeEach, describe, expect, test } from "vitest";

/** Points the happy-dom document at `url` (ASSUMPTION: happy-dom's `window.happyDOM.setURL`). */
function setDocumentUrl(url: string): void {
  const h: unknown = Reflect.get(window, "happyDOM");
  const set: unknown = typeof h === "object" && h !== null ? Reflect.get(h, "setURL") : undefined;
  if (typeof set !== "function") throw new Error("fixture: no happyDOM.setURL");
  Reflect.apply(set, h, [url]);
}
beforeEach(() => setDocumentUrl("https://app.test/"));

const idArb = fc.stringMatching(/^[a-z0-9]{1,12}$/);

describe("k.services: a third-party request from a browser carries no Keel header", () => {
  test.skip("in a browser at `https://app.test`, a GET with no `bearer` sends exactly `accept: application/json`, credentials `same-origin`", async () => {
    await fc.assert(
      fc.asyncProperty(idArb, async (id) => {
        const ctx = simCtx();
        const sent = record(ctx);
        await client().show({ params: { id } }, ctx);
        expect(sent).toHaveLength(1);
        expect(sent[0]?.headers).toEqual({ accept: "application/json" });
        expect(sent[0]?.credentials).toBe("same-origin");
        for (const n of sent[0]?.names ?? []) expect(SAFELISTED).toContain(n);
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  test.skip("in a browser, with `bearer` `abc`, exactly `accept` and `authorization: Bearer abc`", async () => {
    const ctx = simCtx();
    const sent = record(ctx);
    await client().show({ params: { id: "1" }, bearer: secret("abc") }, ctx);
    expect(sent[0]?.headers).toEqual({ accept: "application/json", authorization: "Bearer abc" });
  });

  test.skip("in a browser, a POST with a body sends exactly `accept` and `content-type: application/json`", async () => {
    const ctx = simCtx();
    const sent = record(ctx);
    await client().save({ params: { id: "1" }, body: { note: "n" } }, ctx);
    expect(sent[0]?.headers).toEqual({ accept: "application/json", "content-type": "application/json" });
  });

  test.skip("in a browser, an `events` GET sends exactly `accept: text/event-stream`", async () => {
    const ctx = simCtx();
    const sent = record(ctx);
    await drain(client().watch({}, ctx));
    expect(sent[0]?.headers).toEqual({ accept: "text/event-stream" });
  });

  test.skip("in a browser, none of those requests carries `x-keel` or `x-keel-user`", async () => {
    const ctx = simCtx();
    const sent = record(ctx);
    await client().show({ params: { id: "1" } }, ctx);
    await client().save({ params: { id: "1" }, body: { note: "n" } }, ctx);
    await drain(client().watch({}, ctx));
    expect(sent).toHaveLength(3);
    for (const r of sent) {
      expect(r.names).not.toContain("x-keel");
      expect(r.names).not.toContain("x-keel-user");
    }
  });
});
