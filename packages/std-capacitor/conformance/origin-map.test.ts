// Spec: std.shells, clause "From a page at `capacitor://localhost`, `fetch('/api/lists')` reaches `https://golden-1.example/api/lists` with its method, headers and body. With `connect: ['https://other.example']`, `https://other.example/x` keeps its URL; with `connect: []` it rejects with a `TypeError` whose message holds no part of the URL, makes no native request, and a k.services `base` call to it is `api.network`. So do `http://other.example/x` against `connect: ['https://other.example']`, and `https://other.example.evil.test/x`."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumption: the page origin is the stubbed `location` (also tried at `https://localhost`); a request to the page is an absolute URL on it, as the relative `/api/lists` resolves to one;
// the plugin's HTTP client is the stand-in of fixtures.ts (`vi.mock` of `@capacitor/core`); "reaches" is the final URL, method, headers (at least those sent) and body the native client received.
import { capacitorDrivers } from "@keel/std-capacitor";
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { endpoints, service } from "@keel/services";
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

const odd = fc.stringMatching(/^[qxzjkvw]{8,12}$/);
/** A request to `base`/<odd path> under `connect` rejects with a `TypeError` that shows none of the URL, and nothing reaches the native side. */
async function refused(connect: readonly string[], base: string): Promise<void> {
  await fc.assert(
    fc.asyncProperty(fc.constantFrom(...PAGES), method, odd, odd, async (page, m, seg, key) => {
      const world = begin(page);
      const { net } = capacitorDrivers({ origin: ORIGIN, connect });
      const url = `${base}/${seg}?${key}=1`;
      const err: unknown = await net.fetch(new Request(url, { method: m })).then(
        () => undefined,
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(TypeError);
      const message = err instanceof Error ? err.message : "";
      for (const part of [new URL(url).host, seg, key, "other.example"]) expect(message).not.toContain(part);
      expect(world.wire).toEqual([]);
      end();
    }),
    run,
  );
}

describe("std.shells: the origin map", () => {
  afterEach(end);

  test("a request on the page's origin reaches `origin` with its path, search, method, headers and body", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...PAGES), method, path, search, headers, chars, async (page, m, p, q, h, b) => {
        const world = begin(page);
        const { net } = capacitorDrivers({ origin: ORIGIN, connect: [] });
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

  test("with `connect: ['https://other.example']`, `https://other.example/x` keeps its URL", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...PAGES), method, path, search, async (page, m, p, q) => {
        const world = begin(page);
        const { net } = capacitorDrivers({ origin: ORIGIN, connect: [OTHER] });
        await net.fetch(new Request(`${OTHER}${p}${q}`, { method: m }));
        expect(world.wire.map((w) => w.url)).toEqual([`${OTHER}${p}${q}`]);
        expect(world.wire[0]?.method).toBe(m);
        end();
      }),
      run,
    );
  });

  test("with `connect: []`, `https://other.example/x` rejects with a `TypeError` whose message holds no part of the URL and makes no native request", async () => {
    await refused([], `${OTHER}`);
  });

  test("`http://other.example/x` against `connect: ['https://other.example']` rejects with a `TypeError` whose message holds no part of the URL and makes no native request", async () => {
    await refused([OTHER], "http://other.example");
  });

  test("`https://other.example.evil.test/x` against `connect: ['https://other.example']` rejects with a `TypeError` whose message holds no part of the URL and makes no native request", async () => {
    await refused([OTHER], "https://other.example.evil.test");
  });

  test("a k.services `base` call to a refused origin is `api.network`", async () => {
    for (const [connect, base] of [
      [[], OTHER],
      [[OTHER], "http://other.example"],
      [[OTHER], "https://other.example.evil.test"],
    ] as const) {
      const world = begin(PAGES[0]);
      const api = service({
        base,
        schema: endpoints({ ping: { method: "GET", path: "/x", output: s.object({}) } }),
      });
      const ctx = createCtx({ mode: "shell", drivers: capacitorDrivers({ origin: ORIGIN, connect }) });
      const r = await api.ping({}, ctx);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("api.network");
      expect(world.wire).toEqual([]);
      end();
    }
  });
});
