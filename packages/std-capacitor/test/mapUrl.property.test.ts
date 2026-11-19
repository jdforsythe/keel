// The origin map: a URL on the page's scheme and host goes to `origin` with its path and search; any other URL is unchanged.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { mapUrl } from "../src/internal/mapUrl.ts";

const run = { seed: 1337, numRuns: 200 };
const ORIGIN = new URL("https://golden-1.example");
const seg = fc.stringMatching(/^[a-z0-9_~-]{1,6}$/);
const path = fc.array(seg, { maxLength: 3 }).map((s) => `/${s.join("/")}`);
const search = fc.option(
  fc.tuple(seg, seg).map(([k, v]) => `?${k}=${v}`),
  { nil: "" },
);
const pages = fc.constantFrom(
  "capacitor://localhost",
  "https://localhost",
  "tauri://localhost",
  "http://tauri.localhost",
);
const others = fc.constantFrom(
  "https://other.example",
  "https://localhost:8443",
  "capacitor://elsewhere",
  "http://localhost",
);

const at = (page: string) => {
  const u = new URL(`${page}/`);
  return { protocol: u.protocol, host: u.host };
};

describe("mapUrl", () => {
  test("a URL on the page goes to `origin` with its path and search", () => {
    fc.assert(
      fc.property(pages, path, search, (page, p, q) => {
        expect(mapUrl(`${page}${p}${q}`, ORIGIN, at(page))).toBe(`${ORIGIN.origin}${p}${q}`);
      }),
      run,
    );
  });

  test("a URL on another origin is unchanged, and so is every URL without a page", () => {
    fc.assert(
      fc.property(pages, others, path, search, (page, other, p, q) => {
        const url = new URL(`${other}${p}${q}`).href;
        expect(mapUrl(url, ORIGIN, at(page))).toBe(url);
        const own = new URL(`${page}${p}${q}`).href;
        expect(mapUrl(own, ORIGIN, undefined)).toBe(own);
      }),
      run,
    );
  });
});
