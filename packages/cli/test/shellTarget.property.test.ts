// `keel build --target` before any work: the KEEL_ORIGIN rule.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { shellOrigin } from "../src/shell/shellOrigin.ts";

const run = { seed: 1337, numRuns: 200 };
const host = fc.stringMatching(/^[a-z]{1,8}\.(example|test)$/);
const port = fc.option(fc.integer({ min: 1, max: 65535 }), { nil: undefined });
const withPort = (h: string, p: number | undefined) => (p === undefined ? h : `${h}:${p}`);

describe("shellOrigin", () => {
  test("https: anywhere and http: on localhost are kept as the origin; anything else is refused", () => {
    fc.assert(
      fc.property(host, port, fc.constantFrom("", "/x", "/a/b?q=1"), (h, p, rest) => {
        expect(shellOrigin(`https://${withPort(h, p)}${rest}`)).toBe(new URL(`https://${withPort(h, p)}`).origin);
        expect(shellOrigin(`http://${withPort("localhost", p)}${rest}`)).toBe(
          new URL(`http://${withPort("localhost", p)}`).origin,
        );
        for (const bad of [`http://${withPort(h, p)}${rest}`, `ftp://${h}`, h, "", `capacitor://${h}`])
          expect(shellOrigin(bad), bad).toBeUndefined();
      }),
      run,
    );
    expect(shellOrigin(undefined)).toBeUndefined();
  });
});
