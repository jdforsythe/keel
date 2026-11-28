// `service({ contract })` over the net never follows a redirect (k.topology Calls and peers: a split gives no other
// value): a 3xx is `api.status` with that status, as in process. `service({ base })` follows none either.
// Seed 1337; sim ctx and net.
import { createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { endpoints } from "../src/endpoints.ts";
import { service } from "../src/service.ts";

const SEED = 1337;
const entries = {
  get: { method: "GET", path: "/b/secret", output: s.json() },
  save: { method: "POST", path: "/b", body: s.object({ n: s.int() }), output: s.json() },
  feed: { method: "GET", path: "/b/feed", output: s.json(), events: true },
} as const;
const schema = endpoints(entries);
const c = contract("b", {
  "b.get": entries.get,
  "b.save": entries.save,
  "b.feed": entries.feed,
});

describe("module calls and redirects", () => {
  test("a 3xx from the module's URL is api.status with that status and the request is sent redirect: manual", async () => {
    const client = service({ contract: c });
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(301, 302, 303, 307, 308), async (status) => {
        const ctx = createCtx({ mode: "sim", seed: SEED });
        const sent: Request[] = [];
        ctx.net.route("http://b.keel.invalid/*", (req) => {
          sent.push(req);
          return new Response(null, { status, headers: { location: "/b?next=%2Fb%2Fsecret" } });
        });
        expect(await client.get({}, ctx)).toEqual({
          ok: false,
          error: { code: "api.status", message: `status ${status}`, data: { status, body: null } },
        });
        expect(await client.save({ body: { n: 1 } }, ctx)).toMatchObject({ ok: false, error: { data: { status } } });
        const events = [];
        for await (const r of client.feed({}, ctx)) events.push(r);
        expect(events).toMatchObject([{ ok: false, error: { code: "api.status", data: { status } } }]);
        expect(sent.map((r) => r.redirect)).toEqual(["manual", "manual", "manual"]);
        expect(await sent[1]?.json()).toEqual({ n: 1 });
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  test("a base service's request follows no redirect", async () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    let sent: Request | undefined;
    ctx.net.route("https://api.test/*", (req) => {
      sent = req;
      return new Response("null");
    });
    await service({ base: "https://api.test", schema }).get({}, ctx);
    expect(sent?.redirect).toBe("manual");
  });
});
