// @vitest-environment happy-dom
// Spec: k.topology, clause "With `x` forwarding to `y` and `y`'s page `b.tools` at `/tools` `local: true`, `GET /tools` and `GET /%74ools` to `x` with `Host: 127.0.0.1:<port>` and `Sec-Fetch-Site: none`, from `127.0.0.1` and from `10.0.0.5`, each reach `y` with `x-keel-forwarded: 1` and answer 403 `keel.denied` with the six k.security headers, its loader not run; to `y` itself from `127.0.0.1` with that `Host` and `Sec-Fetch-Site`, `GET /tools` answers the page, and with `x-keel-forwarded: 1` or `x-keel-forwarded: 0` besides, 403 `keel.denied`."
// Seed 1337 (fast-check: the header's value, the remote address, `Host` and `Sec-Fetch-Site`). Fixture: local-routes-peer-support.ts (`x` serves `a`, `y` serves `b` with
// the `local: true` page `b.tools` carrying a guard and a loader, the page `b.slug` at `/:slug`, and `b.open`; `x` names `y` in `peers` by URL `http://y.test`).
// "its loader not run" is read from `hits`: the loader and guard of `b.tools` and the `/:slug` loader of `y` each count their own runs.
// ASSUMED: a request that already carries `x-keel-forwarded` is not forwarded (k.topology, loop guard), so "over any value" is exercised on the peer side, which refuses whatever the value.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { GOOD, NONE, PORT, SEED, conn, get, pair, six } from "./local-routes-peer-support.ts";

const FROM = ["127.0.0.1", "10.0.0.5"];
const PATHS = ["/tools", "/%74ools", "/tool%73"];
const octet = fc.integer({ min: 0, max: 255 });
const address = fc.oneof(
  fc.constantFrom("127.0.0.1", "::1", "::ffff:127.0.0.1", "10.0.0.5"),
  fc.tuple(octet, octet, octet, octet).map((p) => p.join(".")),
);
const host = fc.constantFrom(`127.0.0.1:${PORT}`, `localhost:${PORT}`, `[::1]:${PORT}`, "example.com");
const site = fc.constantFrom("none", "same-origin", "same-site", "cross-site");

describe("k.topology Calls and peers: a `local` route of a peer", () => {
  it("`GET /tools` and `GET /%74ools` to `x` with `Host: 127.0.0.1:<port>` and `Sec-Fetch-Site: none`, from `127.0.0.1` and from `10.0.0.5`, each reach `y` with `x-keel-forwarded: 1`", async () => {
    for (const path of PATHS) {
      for (const from of FROM) {
        const { x, seen } = await pair();
        await x.fetch(get(path, GOOD), conn(from));
        expect(seen, `${path} ${from}`).toEqual([{ method: "GET", path, forwarded: "1" }]);
      }
    }
  });

  it("each answers 403 `keel.denied`", async () => {
    for (const path of PATHS) {
      for (const from of FROM) {
        const { x } = await pair();
        const res = await x.fetch(get(path, GOOD), conn(from));
        expect(res.status, `${path} ${from}`).toBe(403);
        expect(await res.text(), `${path} ${from}`).toContain("keel.denied");
      }
    }
  });

  it("each answers with the six k.security headers", async () => {
    for (const path of PATHS) {
      for (const from of FROM) {
        const { x } = await pair();
        six(await x.fetch(get(path, GOOD), conn(from)), `${path} ${from}`);
      }
    }
  });

  it("each leaves `y`'s loader, its guard and its `/:slug` loader not run, `y` having a `/:slug` route", async () => {
    for (const path of PATHS) {
      for (const from of FROM) {
        const { x, hits } = await pair();
        await x.fetch(get(path, GOOD), conn(from));
        expect(hits, `${path} ${from}`).toEqual(NONE);
      }
    }
  });

  it("the forwarder judges no route: from any remote address, `Host` and `Sec-Fetch-Site` the request reaches `y` with `x-keel-forwarded: 1` and is refused there", async () => {
    const { x, seen, hits } = await pair();
    await fc.assert(
      fc.asyncProperty(address, host, site, fc.constantFrom(...PATHS), async (a, h, f, p) => {
        const before = seen.length;
        const label = `${a} ${h} ${f} ${p}`;
        const res = await x.fetch(get(p, { host: h, "sec-fetch-site": f }), conn(a));
        expect(res.status, label).toBe(403);
        expect(seen.length, label).toBe(before + 1);
        expect(seen[before]?.forwarded, label).toBe("1");
        six(res, label);
      }),
      { seed: SEED, numRuns: 40 },
    );
    expect(hits).toEqual(NONE);
  });

  it("a `HEAD` of those paths reaches `y` with `x-keel-forwarded: 1` and answers 403 with the six k.security headers, its loader not run", async () => {
    for (const path of PATHS) {
      for (const from of FROM) {
        const { x, seen, hits } = await pair();
        const res = await x.fetch(get(path, GOOD, "HEAD"), conn(from));
        expect(res.status, `${path} ${from}`).toBe(403);
        expect(seen, `${path} ${from}`).toEqual([{ method: "HEAD", path, forwarded: "1" }]);
        six(res, `${path} ${from}`);
        expect(hits, `${path} ${from}`).toEqual(NONE);
      }
    }
  });

  it("to `y` itself from `127.0.0.1` with that `Host` and `Sec-Fetch-Site`, `GET /tools` answers the page", async () => {
    const { y, hits } = await pair();
    const res = await y.fetch(get("/tools", GOOD), conn("127.0.0.1"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("tools");
    expect(hits.tools).toBe(1);
  });

  it("with `x-keel-forwarded: 1` or `x-keel-forwarded: 0` besides, `y` answers 403 `keel.denied` with the six k.security headers", async () => {
    for (const value of ["1", "0"]) {
      for (const path of PATHS) {
        const { y } = await pair();
        const res = await y.fetch(get(path, { ...GOOD, "x-keel-forwarded": value }), conn("127.0.0.1"));
        expect(res.status, `${value} ${path}`).toBe(403);
        expect(await res.text(), `${value} ${path}`).toContain("keel.denied");
        six(res, `${value} ${path}`);
      }
    }
  });

  it("with `x-keel-forwarded` of any value besides, `y` runs no handler, loader or guard", async () => {
    const value = fc.oneof(fc.constantFrom("1", "0", "", "true", "2"), fc.stringMatching(/^[!-~]{1,8}$/));
    const { y, hits } = await pair();
    await fc.assert(
      fc.asyncProperty(value, fc.constantFrom(...PATHS), async (v, p) => {
        const res = await y.fetch(get(p, { ...GOOD, "x-keel-forwarded": v }), conn("127.0.0.1"));
        expect(res.status, `${JSON.stringify(v)} ${p}`).toBe(403);
      }),
      { seed: SEED, numRuns: 40 },
    );
    expect(hits).toEqual(NONE);
  });

  it("a client sending `x-keel-forwarded` straight to `y` is refused on the `local` route whatever its address, `Host` or `Sec-Fetch-Site`: the header grants nothing", async () => {
    const { y, hits } = await pair();
    await fc.assert(
      fc.asyncProperty(address, host, site, fc.constantFrom(...PATHS), async (a, h, f, p) => {
        const label = `${a} ${h} ${f} ${p}`;
        const res = await y.fetch(get(p, { host: h, "sec-fetch-site": f, "x-keel-forwarded": "1" }), conn(a));
        expect(res.status, label).toBe(403);
        expect(await res.text(), label).toContain("keel.denied");
        six(res, label);
      }),
      { seed: SEED, numRuns: 40 },
    );
    expect(hits).toEqual(NONE);
  });

  it("a route of `y` that is not `local` is still forwarded and answered, `/open` and a `/:slug` path alike", async () => {
    const { x, seen, hits } = await pair();
    const open = await x.fetch(get("/open", GOOD), conn("127.0.0.1"));
    expect(open.status).toBe(200);
    expect(await open.text()).toContain("open");
    const other = await x.fetch(get("/elsewhere", GOOD), conn("10.0.0.5"));
    expect(other.status).toBe(200);
    expect(await other.text()).toContain("slug");
    expect(seen.map((r) => `${r.path} ${r.forwarded}`)).toEqual(["/open 1", "/elsewhere 1"]);
    expect(hits).toEqual({ ...NONE, open: 1, slug: 1 });
  });
});
