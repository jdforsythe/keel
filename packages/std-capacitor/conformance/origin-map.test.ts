// Spec: std.shells, Conformance "From a page at `capacitor://localhost`, `fetch('/api/lists')` reaches `https://golden-1.example/api/lists` with its method, headers and body; `https://other.example/x` keeps its URL."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumption: the page origin is the stubbed `location` (also tried at `https://localhost`); a request to the page is an absolute URL on it, as the relative `/api/lists` resolves to one;
// the plugin's HTTP client is the stand-in of fixtures.ts (`vi.mock` of `@capacitor/core`); "reaches" is the final URL, method, headers (at least those sent) and body the native client received.
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
const path = fc.array(chars, { minLength: 1, maxLength: 3 }).map((parts) => `/${parts.join("/")}`);
const search = fc.option(
  chars.map((q) => `?q=${q}&n=1`),
  { nil: "" },
);
const headers = fc.dictionary(fc.constantFrom("x-a", "x-b", "x-c"), chars);
const method = fc.constantFrom("GET", "POST", "PUT", "PATCH", "DELETE");

describe("std.shells: the origin map", () => {
  afterEach(end);

  test("a request on the page's origin reaches `origin` with its path, search, method, headers and body", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...PAGES), method, path, search, headers, chars, async (page, m, p, q, h, b) => {
        const world = begin(page);
        const { net } = capacitorDrivers({ origin: ORIGIN });
        const body = m === "GET" ? undefined : b;
        const res = await net.fetch(new Request(`${page}${p}${q}`, { method: m, headers: h, body: body ?? null }));
        expect(res).toBeInstanceOf(Response);
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("ok");
        expect(world.wire).toHaveLength(1);
        const seen = world.wire[0];
        expect(seen?.url).toBe(`${ORIGIN.origin}${p}${q}`);
        expect(seen?.method).toBe(m);
        for (const [k, v] of Object.entries(h)) expect(seen?.headers[k]).toBe(v);
        expect(seen?.body).toBe(body ?? null);
        end();
      }),
      run,
    );
  });

  test("a request to another origin keeps its URL", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...PAGES), method, path, search, async (page, m, p, q) => {
        const world = begin(page);
        const { net } = capacitorDrivers({ origin: ORIGIN });
        await net.fetch(new Request(`${OTHER}${p}${q}`, { method: m }));
        expect(world.wire.map((w) => w.url)).toEqual([`${OTHER}${p}${q}`]);
        expect(world.wire[0]?.method).toBe(m);
        end();
      }),
      run,
    );
  });
});
