// Spec: std.shells, Conformance "With the default `redirect`, a GET of `/a` answered 302 to `/b` then 200 resolves with the 200 after two native requests, neither asking the native client to follow. Answered 302 to `https://evil.example/x`, it rejects with a `TypeError` and no native request names `evil.example`. Answered 302 to a `connect` origin, the second request goes there without the first's `authorization`."
// Spec: std.shells, Conformance "A POST with a body answered 303 to `/done` sends a GET of `/done` with no body and no `content-type`; answered 307, a POST with the same body. Every answer a 302 to the next path: 21 native requests, then a `TypeError`. A 302 with no `location` resolves as the 302."
// Spec: std.shells, Conformance "With `redirect: 'error'`, a 302 rejects with a `TypeError` after one native request."
// Seed: 1337. The std-tauri half of packages/std-capacitor/conformance/redirects.test.ts; the page is `tauri://localhost` here.
// @vitest-environment happy-dom
// Assumption: the stand-in native side (fixtures.ts) follows a 3xx itself unless the driver asks for no redirects (the native client of RFC 0142), so a driver that leaves the following to it puts hops on the wire
// that bypass its list and drop no `authorization`; the count of native requests is `world.wire.length`, one entry per hop the native side sent.
import { tauriDrivers } from "@keel/std-tauri";
import fc from "fast-check";
import { afterEach, describe, expect, test } from "vitest";
import { ORIGIN, PAGES, begin, end } from "./fixtures.ts";

const run = { seed: 1337, numRuns: 40 };
const chars = fc.array(fc.constantFrom(..."abcdefgh0123456789"), { minLength: 1, maxLength: 6 }).map((c) => c.join(""));
const SELF = ORIGIN.origin;
const EVIL = "https://evil.example";
const CONNECT = "https://api.example";
const drivers = (connect: readonly string[] = [CONNECT]) => tauriDrivers({ origin: ORIGIN, connect });
const redirect = (status: number, to: string) => ({ status, headers: { location: to } });

describe("std.shells: redirects the driver follows", () => {
  afterEach(end);

  test("with the default `redirect`, a GET of `/a` answered 302 to `/b` then 200 resolves with the 200 after two native requests", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...PAGES), chars, chars, async (page, a, b) => {
        const world = begin(page);
        world.backend((req) => (req.url.endsWith(`/${a}x`) ? redirect(302, `/${b}y`) : { status: 200, body: "done" }));
        const res = await drivers().net.fetch(new Request(`${SELF}/${a}x`));
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("done");
        expect(world.wire.map((w) => w.url)).toEqual([`${SELF}/${a}x`, `${SELF}/${b}y`]);
        end();
      }),
      run,
    );
  });

  test("answered 302 to `https://evil.example/x`, it rejects with a `TypeError` and no native request names `evil.example`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...PAGES), fc.constantFrom(301, 302, 303, 307, 308), async (page, status) => {
        const world = begin(page);
        world.backend((req) => (req.url.includes("evil.example") ? { status: 200 } : redirect(status, `${EVIL}/x`)));
        await expect(drivers().net.fetch(new Request(`${SELF}/a`))).rejects.toBeInstanceOf(TypeError);
        expect(world.wire.map((w) => w.url).filter((u) => u.includes("evil.example"))).toEqual([]);
        expect(world.wire).toHaveLength(1);
        end();
      }),
      run,
    );
  });

  test("a hop to a scheme or origin outside the list is refused: `http:` of a listed host, a listed host as a suffix, another scheme", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          "http://api.example/x",
          "https://api.example.evil.test/x",
          "ftp://api.example/x",
          "https://api.example:8443/x",
        ),
        async (to) => {
          const world = begin(PAGES[0]);
          world.backend((req) => (req.url === `${SELF}/a` ? redirect(302, to) : { status: 200 }));
          await expect(drivers().net.fetch(new Request(`${SELF}/a`))).rejects.toBeInstanceOf(TypeError);
          expect(world.wire.map((w) => w.url)).toEqual([`${SELF}/a`]);
          end();
        },
      ),
      run,
    );
  });

  test("answered 302 to a `connect` origin, the second request goes there without the first's `authorization`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...PAGES), chars, chars, async (page, token, p) => {
        const world = begin(page);
        world.backend((req) => (req.url === `${SELF}/a` ? redirect(302, `${CONNECT}/${p}`) : { status: 200 }));
        const res = await drivers().net.fetch(
          new Request(`${SELF}/a`, { headers: { authorization: `Bearer ${token}`, "x-keep": "1" } }),
        );
        expect(res.status).toBe(200);
        expect(world.wire.map((w) => w.url)).toEqual([`${SELF}/a`, `${CONNECT}/${p}`]);
        expect(world.wire[0]?.headers.authorization).toBe(`Bearer ${token}`);
        expect(world.wire[1]?.headers.authorization).toBeUndefined();
        end();
      }),
      run,
    );
  });

  test("a hop to the same origin keeps `authorization`", async () => {
    await fc.assert(
      fc.asyncProperty(chars, async (token) => {
        const world = begin(PAGES[0]);
        world.backend((req) => (req.url === `${SELF}/a` ? redirect(302, "/b") : { status: 200 }));
        await drivers().net.fetch(new Request(`${SELF}/a`, { headers: { authorization: `Bearer ${token}` } }));
        expect(world.wire[1]?.headers.authorization).toBe(`Bearer ${token}`);
        end();
      }),
      run,
    );
  });

  test("a POST with a body answered 303 to `/done` sends a GET of `/done` with no body and no `content-type`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("POST", "PUT", "PATCH", "DELETE"), chars, async (method, body) => {
        const world = begin(PAGES[0]);
        world.backend((req) => (req.url === `${SELF}/a` ? redirect(303, "/done") : { status: 200 }));
        await drivers().net.fetch(
          new Request(`${SELF}/a`, { method, body, headers: { "content-type": "text/plain" } }),
        );
        expect(world.wire).toHaveLength(2);
        expect(world.wire[1]?.url).toBe(`${SELF}/done`);
        expect(world.wire[1]?.method).toBe("GET");
        expect(world.wire[1]?.body).toBeNull();
        expect(world.wire[1]?.headers["content-type"]).toBeUndefined();
        end();
      }),
      run,
    );
  });

  test("a 303 after `HEAD` stays `HEAD`", async () => {
    const world = begin(PAGES[0]);
    world.backend((req) => (req.url === `${SELF}/a` ? redirect(303, "/done") : { status: 200 }));
    await drivers().net.fetch(new Request(`${SELF}/a`, { method: "HEAD" }));
    expect(world.wire.map((w) => w.method)).toEqual(["HEAD", "HEAD"]);
  });

  test("a 301 or 302 after a POST continues as a GET with no body; after another method, it repeats method and body", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(301, 302),
        fc.constantFrom("PUT", "PATCH", "DELETE"),
        chars,
        async (status, other, body) => {
          const world = begin(PAGES[0]);
          world.backend((req) => (req.url.endsWith("/a") ? redirect(status, "/done") : { status: 200 }));
          const net = drivers().net;
          await net.fetch(
            new Request(`${SELF}/a`, { method: "POST", body, headers: { "content-type": "text/plain" } }),
          );
          expect(world.wire[1]?.method).toBe("GET");
          expect(world.wire[1]?.body).toBeNull();
          expect(world.wire[1]?.headers["content-type"]).toBeUndefined();
          world.wire.length = 0;
          await net.fetch(new Request(`${SELF}/a`, { method: other, body }));
          expect(world.wire[1]?.method).toBe(other);
          expect(world.wire[1]?.body).toBe(body);
          end();
        },
      ),
      run,
    );
  });

  test("answered 307 or 308, a POST with a body sends a POST with the same body", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(307, 308), chars, async (status, body) => {
        const world = begin(PAGES[0]);
        world.backend((req) => (req.url === `${SELF}/a` ? redirect(status, "/done") : { status: 200 }));
        await drivers().net.fetch(new Request(`${SELF}/a`, { method: "POST", body }));
        expect(world.wire).toHaveLength(2);
        expect(world.wire[1]?.url).toBe(`${SELF}/done`);
        expect(world.wire[1]?.method).toBe("POST");
        expect(world.wire[1]?.body).toBe(body);
        end();
      }),
      run,
    );
  });

  test("every answer a 302 to the next path: 21 native requests, then a `TypeError`; 20 redirects then a 200 resolve", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 20 }), async (n) => {
        const world = begin(PAGES[0]);
        const hop = (url: string): number => Number(url.slice(url.lastIndexOf("/") + 1)) || 0;
        world.backend((req) => (hop(req.url) < n ? redirect(302, `/${hop(req.url) + 1}`) : { status: 200 }));
        const res = await drivers().net.fetch(new Request(`${SELF}/0`));
        expect(res.status).toBe(200);
        expect(world.wire).toHaveLength(n + 1);
        end();
      }),
      run,
    );
    const world = begin(PAGES[0]);
    world.backend((req) => redirect(302, `/${Number(req.url.slice(req.url.lastIndexOf("/") + 1)) + 1}`));
    await expect(drivers().net.fetch(new Request(`${SELF}/0`))).rejects.toBeInstanceOf(TypeError);
    expect(world.wire).toHaveLength(21);
  });

  test("a 302 with no `location` resolves as the 302", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(301, 302, 303, 307, 308), async (status) => {
        const world = begin(PAGES[0]);
        world.backend(() => ({ status }));
        const res = await drivers().net.fetch(new Request(`${SELF}/a`));
        expect(res.status).toBe(status);
        expect(world.wire).toHaveLength(1);
        end();
      }),
      run,
    );
  });

  test("with `redirect: 'error'`, a 302 rejects with a `TypeError` after one native request", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(301, 302, 303, 307, 308), fc.constantFrom(SELF, CONNECT), async (status, to) => {
        const world = begin(PAGES[0]);
        world.backend(() => redirect(status, `${to}/b`));
        await expect(drivers().net.fetch(new Request(`${SELF}/a`, { redirect: "error" }))).rejects.toBeInstanceOf(
          TypeError,
        );
        expect(world.wire).toHaveLength(1);
        end();
      }),
      run,
    );
  });
});
