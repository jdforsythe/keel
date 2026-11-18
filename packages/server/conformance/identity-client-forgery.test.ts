// Spec: k.user, Conformance "With `identify` answering `''`, a request carrying `x-keel-user: u2`, `?user=u2`, a body field `user` and a cookie `user=u2` gets `user` `''`."
// Spec: k.user, User "No header, cookie, search or body value of the client sets `user`."
// Spec: k.user, Across deployables "A server that verifies it uses it as `user` and runs no `identify`; any other `x-keel-user` is ignored."
// Seed 1337 (fc.assert below). The signed header's own cases are in identity-peers.test.ts.
// @vitest-environment node
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, rig } from "./identity-support.ts";

const word = fc.stringMatching(/^[A-Za-z0-9._-]{1,40}$/);

describe("k.user: the client cannot set `user`", () => {
  test("With `identify` answering `''`, a request carrying `x-keel-user: u2`, `?user=u2`, a body field `user` and a cookie `user=u2` gets `user` `''`", async () => {
    const r = await rig({ identify: async () => "" });
    const hit = await r.get("/who?user=u2", { "x-keel-user": "u2", cookie: "user=u2" });
    expect(hit.status).toBe(200);
    expect(r.seen.guard).toEqual([""]);
    expect(r.seen.loader).toEqual([""]);
    const written = await r.post("/who?user=u2", { user: "u2" }, { "x-keel-user": "u2", cookie: "user=u2" });
    expect(written.status).toBeLessThan(400);
    expect(r.seen.action).toEqual([""]);
    expect(r.identified).toHaveLength(2);
  });

  test("No header, cookie, search or body value of the client sets `user`, whatever it holds", async () => {
    await fc.assert(
      fc.asyncProperty(word, word, async (forged, real) => {
        const r = await rig({ identify: async () => real });
        await r.get(`/who?user=${forged}`, { "x-keel-user": forged, cookie: `user=${forged}; x-keel-user=${forged}` });
        await r.get("/api/who", { "x-keel-user": `${forged}.9999999999999.${forged}` });
        await r.post("/who", { user: forged }, { "x-keel-user": forged, cookie: `user=${forged}` });
        expect(r.seen.guard).toEqual([real, real]);
        expect(r.seen.loader).toEqual([real]);
        expect(r.seen.api).toEqual([real]);
        expect(r.seen.action).toEqual([real]);
        expect(r.identified).toHaveLength(3);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  test("with no identity source a forged `x-keel-user` leaves `user` `''`", async () => {
    await fc.assert(
      fc.asyncProperty(word, async (forged) => {
        const r = await rig();
        await r.get("/who", { "x-keel-user": forged });
        expect(r.seen.loader).toEqual([""]);
      }),
      { seed: SEED, numRuns: 15 },
    );
  });
});
