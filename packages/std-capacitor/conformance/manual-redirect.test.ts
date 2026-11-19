// Spec: k.return, clause "With `redirect: 'manual'`, std-capacitor's and std-tauri's `net` resolve a 303 with its `location` and no `set-cookie`, and the next request to that origin carries the cookie."
// Seed: 1337. This file is the std-capacitor half; the other package has the same file name.
// @vitest-environment happy-dom
// Assumption: the native stand-in (fixtures.ts) follows a 3xx as GET like the platform clients do unless the driver asks for no redirects, and keeps each response's `set-cookie` in its jar;
// so a driver that does not honour `redirect: 'manual'` resolves the followed answer (status 200) instead of the 303, and the wire holds the extra hop.
// Not asserted (device only, k.return Limits): that the real platform stores keep a cookie set on a manual 3xx.
import { capacitorDrivers } from "@keel/std-capacitor";
import fc from "fast-check";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ORIGIN, PAGES, begin, end } from "./fixtures.ts";

// capacitor-mock-begin
vi.mock("@capacitor/core", async (original) => {
  const actual = await original<typeof import("@capacitor/core")>();
  const fixtures = await import("./fixtures.ts");
  return {
    ...actual,
    registerPlugin: fixtures.registerPlugin(actual.registerPlugin),
    CapacitorCookies: fixtures.nativeCookies,
  };
});
// capacitor-mock-end

const run = { seed: 1337, numRuns: 60 };
const chars = fc.array(fc.constantFrom(..."abcdefgh0123456789"), { minLength: 1, maxLength: 6 }).map((c) => c.join(""));
const statuses = fc.constantFrom(301, 302, 303, 307, 308);

describe("k.return: a manual redirect resolves as it came", () => {
  afterEach(end);

  test("with redirect manual a 303 resolves with its status and location, no set-cookie reaches the page, and nothing is followed", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...PAGES), chars, chars, statuses, async (page, name, value, status) => {
        const world = begin(page);
        world.backend((req) =>
          req.url.endsWith("/sign-in")
            ? { status, headers: { location: "/api/auth/done", "set-cookie": `${name}=${value}; Path=/` } }
            : { status: 200, body: "followed" },
        );
        const { net } = capacitorDrivers({ origin: ORIGIN });
        const res = await net.fetch(new Request(`${ORIGIN.origin}/sign-in`, { method: "POST", redirect: "manual" }));
        expect(res.status).toBe(status);
        expect(res.headers.get("location")).toBe("/api/auth/done");
        expect(res.headers.get("set-cookie")).toBeNull();
        expect(world.wire.map((w) => w.url)).toEqual([`${ORIGIN.origin}/sign-in`]);
        expect(document.cookie).toBe("");
        end();
      }),
      run,
    );
  });

  test("the next request to that origin carries the cookie the 303 set, from the page's origin too", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...PAGES), chars, chars, async (page, name, value) => {
        const world = begin(page);
        world.backend((req) =>
          req.url.endsWith("/sign-in")
            ? { status: 303, headers: { location: "/api/auth/done", "set-cookie": `${name}=${value}; Path=/` } }
            : { status: 200 },
        );
        const { net } = capacitorDrivers({ origin: ORIGIN });
        const first = await net.fetch(new Request(`${ORIGIN.origin}/sign-in`, { method: "POST", redirect: "manual" }));
        expect(first.status).toBe(303);
        await net.fetch(new Request(`${ORIGIN.origin}/api/auth/done`, { redirect: "manual" }));
        await net.fetch(new Request(`${page}/viaPage`));
        const byUrl = (u: string) => world.wire.find((w) => w.url === u);
        expect(byUrl(`${ORIGIN.origin}/sign-in`)?.headers.cookie).toBeUndefined();
        expect(byUrl(`${ORIGIN.origin}/api/auth/done`)?.headers.cookie).toContain(`${name}=${value}`);
        expect(byUrl(`${ORIGIN.origin}/viaPage`)?.headers.cookie).toContain(`${name}=${value}`);
        end();
      }),
      run,
    );
  });
});
