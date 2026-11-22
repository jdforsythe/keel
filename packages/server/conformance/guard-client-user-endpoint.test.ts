// Spec: k.guards, Conformance "A `createApp` with `identify` answering `'u1'` answers `GET /__keel/user` with `x-keel: 1` 200 `{ \"user\": \"u1\" }` and `cache-control: no-store`, one `identify` call; without `x-keel: 1`, 403 and `identify` uncalled; with no identity source, 404."
// Spec: k.guards, Client "A `node` deployable with an identity source answers `GET /__keel/user` carrying `x-keel: 1` with `{ user }`, `identify`'s answer (k.user), and `cache-control: no-store`; without `x-keel: 1`, 403 `keel.denied`."
// Spec: k.user, Identity source "It runs once per request the deployable answers on a route (page, API route, event stream), after the same-site check and before guards; never for assets, `/__keel/*` but `/__keel/user` (k.guards Client), a forwarded path or `handle`."
// Spec: k.user, User "No header, cookie, search or body value of the client sets `user`."
// Seed 1337 (fc.assert below). Pending: RFC 0186 is not built. To un-skip: change `test.skip` to `test` in each skipped case once `createApp` answers `/__keel/user`. The no-identity-source case is live.
// @vitest-environment node
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, rig } from "./identity-support.ts";

const USER = "/__keel/user";
const KEEL = { "x-keel": "1" };
const userId = fc.string({ minLength: 0, maxLength: 256 });

describe("k.guards Client: GET /__keel/user", () => {
  test.skip('with `identify` answering `\'u1\'`, `GET /__keel/user` with `x-keel: 1` is 200 `{ "user": "u1" }` with `cache-control: no-store`, one `identify` call', async () => {
    const r = await rig({ identify: async () => "u1" });
    const res = await r.get(USER, KEEL);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: "u1" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(r.identified).toHaveLength(1);
  });

  test.skip("any user id `identify` answers, `''` included, is the body's `user`, one `identify` call per GET", async () => {
    await fc.assert(
      fc.asyncProperty(userId, async (id) => {
        const r = await rig({ identify: async () => id });
        const res = await r.get(USER, KEEL);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ user: id });
        expect(res.headers.get("cache-control")).toBe("no-store");
        expect(r.identified).toHaveLength(1);
        await r.get(USER, KEEL);
        expect(r.identified).toHaveLength(2);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test.skip("without `x-keel: 1`, 403 `keel.denied` and `identify` uncalled", async () => {
    const r = await rig({ identify: async () => "u1" });
    const res = await r.get(USER);
    expect(res.status).toBe(403);
    expect(await res.text()).toContain("keel.denied");
    expect(r.identified).toEqual([]);
    const other = await r.get(USER, { "x-keel": "0" });
    expect(other.status).toBe(403);
    expect(r.identified).toEqual([]);
  });

  test("with no identity source, `GET /__keel/user` is 404", async () => {
    const r = await rig();
    expect((await r.get(USER, KEEL)).status).toBe(404);
    expect((await r.get(USER)).status).toBe(404);
  });

  test.skip("`identify` runs for `/__keel/user` and not for another `/__keel/*` path", async () => {
    const r = await rig({ identify: async () => "u1" });
    await r.get(USER, KEEL);
    expect(r.identified).toHaveLength(1);
    await r.get("/__keel/other", KEEL);
    expect(r.identified).toHaveLength(1);
  });

  test.skip("a header, cookie or search value naming a user does not change the answer", async () => {
    const r = await rig({ identify: async () => "" });
    const res = await r.get(`${USER}?user=u2`, { ...KEEL, "x-keel-user": "u2", cookie: "user=u2" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: "" });
  });
});
