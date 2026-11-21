// Spec: std.shells, Conformance "A cookie set by a response from `origin` is sent on the next request to `origin` and on none to another origin."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumption: the native side keeps the cookie jar (stand-in in fixtures.ts), so the driver's part is to pass the request and its `set-cookie` response through untouched and keep cookies out of the page;
// a request to the page's origin is mapped to `origin` (origin-map) and so carries the cookie too.
import { capacitorDrivers } from "@keel/std-capacitor";
import fc from "fast-check";
import { afterEach, describe, expect, test, vi } from "vitest";
import { begin, end, ORIGIN, OTHER, PAGES } from "./fixtures.ts";

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

const run = { seed: 1337, numRuns: 100 };
const chars = fc.array(fc.constantFrom(..."abcdefgh0123456789"), { minLength: 1, maxLength: 6 }).map((c) => c.join(""));

describe("std.shells: cookies stay in the shell's cookie store", () => {
  afterEach(end);

  test("a cookie set by a response from `origin` is sent on the next request to `origin` and on none to another origin", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...PAGES), chars, chars, async (page, name, value) => {
        const world = begin(page);
        world.backend((req) =>
          req.url.endsWith("/login")
            ? { status: 200, headers: { "set-cookie": `${name}=${value}; Path=/` } }
            : { status: 200 },
        );
        const { net } = capacitorDrivers({ origin: ORIGIN });
        await net.fetch(new Request(`${ORIGIN.origin}/login`, { method: "POST" }));
        await net.fetch(new Request(`${ORIGIN.origin}/next`));
        await net.fetch(new Request(`${page}/viaPage`));
        await net.fetch(new Request(`${OTHER}/x`));
        const byUrl = (u: string) => world.wire.find((w) => w.url === u);
        expect(byUrl(`${ORIGIN.origin}/login`)?.headers.cookie).toBeUndefined();
        expect(byUrl(`${ORIGIN.origin}/next`)?.headers.cookie).toContain(`${name}=${value}`);
        expect(byUrl(`${ORIGIN.origin}/viaPage`)?.headers.cookie).toContain(`${name}=${value}`);
        expect(byUrl(`${OTHER}/x`)?.headers.cookie).toBeUndefined();
        expect(document.cookie).toBe("");
        end();
      }),
      run,
    );
  });

  test("a cookie set by a response from another origin is not sent to `origin`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...PAGES), chars, chars, async (page, name, value) => {
        const world = begin(page);
        world.backend((req) =>
          req.url.startsWith(OTHER)
            ? { status: 200, headers: { "set-cookie": `${name}=${value}; Path=/` } }
            : { status: 200 },
        );
        const { net } = capacitorDrivers({ origin: ORIGIN });
        await net.fetch(new Request(`${OTHER}/set`));
        await net.fetch(new Request(`${ORIGIN.origin}/next`));
        await net.fetch(new Request(`${OTHER}/again`));
        const byUrl = (u: string) => world.wire.find((w) => w.url === u);
        expect(byUrl(`${ORIGIN.origin}/next`)?.headers.cookie).toBeUndefined();
        expect(byUrl(`${OTHER}/again`)?.headers.cookie).toContain(`${name}=${value}`);
        end();
      }),
      run,
    );
  });
});
