// Spec: std.shells, Conformance "With each package's drivers given `{ connect: ['https://other.example'] }` and no `origin`, from a page at `capacitor://localhost` or `tauri://localhost`, `fetch('/api/lists')` and `fetch('capacitor://localhost/x')` reject with a `TypeError` whose message holds no part of the URL and make no native request; `https://other.example/x` keeps its URL; with `connect: []` every request rejects so."
// Spec: std.shells, API "`net.fetch` maps a request on the page's origin to `origin`, and with no `origin` refuses it"
// Seed: 1337.
// @vitest-environment happy-dom
// Assumption: as origin-map.test.ts, the page is the stubbed `location` and a request to the page is an absolute URL on it, as the relative `/api/lists` resolves to one;
// "no Keel header sent" is read as: no native request exists to carry one, and the one to `connect` carries no `x-keel` header the caller did not set.
import { capacitorDrivers } from "@keel/std-capacitor";
import fc from "fast-check";
import { afterEach, describe, expect, test, vi } from "vitest";
import { OTHER, PAGES, begin, end } from "./fixtures.ts";
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
const method = fc.constantFrom("GET", "POST", "PUT", "PATCH", "DELETE");
const pages: readonly string[] = [...PAGES, "https://localhost"];
// Every URL on the page's own origin a request can name: its own scheme, and the other shell's.
const onPage = (page: string, p: string, q: string): readonly string[] => [
  `${page}${p}${q}`,
  `capacitor://localhost${p}${q}`,
];

/** A request to `url` is refused with a `TypeError` that shows no part of it, and nothing reaches the native side. */
async function refusedAt(connect: readonly string[], page: string, url: string, m: string): Promise<void> {
  const world = begin(page);
  const { net } = capacitorDrivers({ connect });
  const err: unknown = await net.fetch(new Request(url, { method: m })).then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(TypeError);
  const message = err instanceof Error ? err.message : "";
  const u = new URL(url);
  for (const part of [u.host, u.pathname, u.search.slice(1)]) if (part.length > 3) expect(message).not.toContain(part);
  // A refusal, not a crash of the driver: an engine message such as "Cannot read properties of undefined" is no refusal.
  expect(message).not.toMatch(/undefined|Cannot read/);
  expect(world.wire).toEqual([]);
  end();
}

describe("std.shells: drivers with no origin", () => {
  afterEach(end);

  test("with `{ connect: ['https://other.example'] }` and no `origin`, a request on the page's origin rejects with a `TypeError` whose message holds no part of the URL and makes no native request", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...pages), method, path, search, async (page, m, p, q) => {
        for (const url of onPage(page, p, q)) await refusedAt([OTHER], page, url, m);
      }),
      run,
    );
  });

  test("with `{ connect: ['https://other.example'] }` and no `origin`, `https://other.example/x` keeps its URL and carries no Keel header", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...pages), method, path, search, async (page, m, p, q) => {
        const world = begin(page);
        const { net } = capacitorDrivers({ connect: [OTHER] });
        await net.fetch(new Request(`${OTHER}${p}${q}`, { method: m }));
        expect(world.wire.map((w) => w.url)).toEqual([`${OTHER}${p}${q}`]);
        expect(world.wire[0]?.method).toBe(m);
        expect(Object.keys(world.wire[0]?.headers ?? {}).map((h) => h.toLowerCase())).not.toContain("x-keel");
        end();
      }),
      run,
    );
  });

  test("with `{ connect: [] }` and no `origin`, every request rejects with a `TypeError` and makes no native request", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...pages), method, path, search, async (page, m, p, q) => {
        for (const url of [...onPage(page, p, q), `${OTHER}${p}${q}`, `http://other.example${p}${q}`]) {
          await refusedAt([], page, url, m);
        }
      }),
      run,
    );
  });
});
