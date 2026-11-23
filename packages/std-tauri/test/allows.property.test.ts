// The origin list of a shell's net (k.shell Origins): `origin` and the exact `connect` origins, http(s) only. Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { allows } from "../src/internal/allows.ts";

const run = { seed: 1337, numRuns: 300 };
const ORIGIN = new URL("https://golden-1.example");
const label = fc.stringMatching(/^[a-z][a-z0-9]{0,6}$/);
const host = fc.tuple(label, label).map(([a, b]) => `${a}.${b}.test`);
const scheme = fc.constantFrom("https", "http");
const port = fc.option(fc.integer({ min: 1024, max: 9999 }), { nil: undefined });
const listed = fc
  .tuple(scheme, host, port)
  .map(([s, h, p]) => `${s}://${h}${p === undefined ? "" : `:${p}`}`)
  .filter((o) => o !== ORIGIN.origin);
const tail = fc.tuple(label, label).map(([p, q]) => `/${p}?${q}=1`);

describe("allows", () => {
  test("a URL on `origin` or on a listed origin is allowed, whatever its path and search", () => {
    fc.assert(
      fc.property(fc.uniqueArray(listed, { maxLength: 4 }), tail, (connect, t) => {
        expect(allows(`${ORIGIN.origin}${t}`, ORIGIN, connect)).toBe(true);
        for (const o of connect) expect(allows(`${o}${t}`, ORIGIN, connect)).toBe(true);
      }),
      run,
    );
  });

  test("an origin that is not listed is refused: with no list, and with a list that lacks it", () => {
    fc.assert(
      fc.property(fc.uniqueArray(listed, { minLength: 1, maxLength: 4 }), tail, (all, t) => {
        const [out = "", ...connect] = all;
        expect(allows(`${out}${t}`, ORIGIN, [])).toBe(false);
        expect(allows(`${out}${t}`, ORIGIN, connect)).toBe(false);
      }),
      run,
    );
  });

  test("the other scheme, another port, a longer host and a host suffix of a listed origin are refused", () => {
    fc.assert(
      fc.property(host, tail, (h, t) => {
        const connect = [`https://${h}`];
        expect(allows(`http://${h}${t}`, ORIGIN, connect)).toBe(false);
        expect(allows(`https://${h}:8443${t}`, ORIGIN, connect)).toBe(false);
        expect(allows(`https://${h}.evil.test${t}`, ORIGIN, connect)).toBe(false);
        expect(allows(`https://evil-${h}${t}`, ORIGIN, connect)).toBe(false);
        expect(allows(`https://x@${h}${t}`, ORIGIN, connect)).toBe(true);
      }),
      run,
    );
  });

  test("a scheme that is not http(s), and text that is no URL, are refused even when listed", () => {
    fc.assert(
      fc.property(fc.constantFrom("ftp", "file", "ws", "wss", "capacitor", "tauri", "data", "blob"), host, (s, h) => {
        const url = `${s}://${h}/x`;
        expect(allows(url, ORIGIN, [new URL(url).origin, `${s}://${h}`])).toBe(false);
      }),
      run,
    );
    for (const bad of ["", "/x", "golden-1.example", "https://"]) expect(allows(bad, ORIGIN, [bad])).toBe(false);
  });
});
