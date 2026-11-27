// readableHost (k.contract Local routes): the one `Host` server.mjs reads as a host and optional port, unchanged. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { readableHost } from "../src/internal/readableHost.ts";

const SEED = 1337;
const name = fc.stringMatching(/^[a-z][a-z0-9-]{0,10}(\.[a-z][a-z0-9-]{0,10}){0,2}$/);
const port = fc.option(fc.integer({ min: 1, max: 65535 }), { nil: undefined });
const withPort = (h: string, p: number | undefined): string => (p === undefined ? h : `${h}:${p}`);

describe("readableHost", () => {
  it("reads one host and optional port back as given, whatever the case of the header name", () => {
    fc.assert(
      fc.property(name, port, fc.constantFrom("Host", "host", "HOST"), (h, p, key) => {
        const v = withPort(h, p);
        expect(readableHost([key, v, "accept", "*/*"])).toBe(v);
      }),
      { seed: SEED },
    );
  });

  it("refuses two Host headers, alike or not, and none", () => {
    fc.assert(
      fc.property(name, name, port, (a, b, p) => {
        expect(readableHost(["Host", withPort(a, p), "host", withPort(b, p)])).toBeUndefined();
        expect(readableHost(["accept", withPort(a, p)])).toBeUndefined();
      }),
      { seed: SEED },
    );
  });

  it("refuses a Host with a space or a control character anywhere in it", () => {
    fc.assert(
      fc.property(name, name, fc.constantFrom(" ", "\t", "\u0000", "\u007f"), (a, b, c) => {
        expect(readableHost(["Host", `${a}${c}${b}`])).toBeUndefined();
      }),
      { seed: SEED },
    );
  });

  it("refuses an empty Host, an unclosed bracket and an address the URL parser rewrites", () => {
    for (const v of ["", "[::1", "127.0.0.1 :9100", "[::ffff:127.0.0.1]:9100", "0x7f.1:9100", "a:b", "a:"])
      expect(readableHost(["Host", v]), v).toBeUndefined();
    for (const v of ["127.0.0.1:9100", "[::1]:9100", "localhost", "LOCALHOST:9100"])
      expect(readableHost(["Host", v]), v).toBe(v);
  });
});
