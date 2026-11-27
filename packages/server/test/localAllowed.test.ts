import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { localAllowed } from "../src/internal/localAllowed.ts";

const SEED = 1337;
/** A request to `host` with the given `Sec-Fetch-Site` and `X-Forwarded-For` (Node's `Request` keeps `host`; the header is read before the URL). */
const req = (host: string, site?: string, forwarded?: string): Request =>
  new Request("http://127.0.0.1:1/x", {
    headers: {
      host,
      ...(site === undefined ? {} : { "sec-fetch-site": site }),
      ...(forwarded === undefined ? {} : { "x-forwarded-for": forwarded }),
    },
  });

describe("localAllowed (k.contract Local routes)", () => {
  it("allows a loopback remote address, a loopback Host with a port and an own-site navigation", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("127.0.0.1", "::1", "::ffff:127.0.0.1"),
        fc.constantFrom("localhost", "127.0.0.1", "[::1]", "LOCALHOST"),
        fc.integer({ min: 1, max: 65535 }),
        fc.constantFrom("same-origin", "none"),
        (remote, name, port, site) => {
          expect(localAllowed(req(`${name}:${port}`, site), remote)).toBe(true);
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("refuses each condition broken alone, and never reads a forwarding header", () => {
    const host = "127.0.0.1:4100";
    expect(localAllowed(req(host, "none"), undefined)).toBe(false);
    for (const remote of ["192.168.1.5", "10.0.0.5", "::ffff:10.0.0.5", "fe80::1"])
      expect(localAllowed(req(host, "none", "127.0.0.1"), remote), remote).toBe(false);
    for (const h of ["example.com:4100", "127.0.0.1", "localhost", "127.0.0.1.evil.example:4100", "a@127.0.0.1:4100"])
      expect(localAllowed(req(h, "none"), "127.0.0.1"), h).toBe(false);
    for (const site of [undefined, "cross-site", "same-site", "", "NONE"])
      expect(localAllowed(req(host, site), "127.0.0.1"), String(site)).toBe(false);
  });

  it("judges a target in absolute form by its authority, whatever Host says (RFC 9112)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("127.0.0.1:4100", "localhost:4100", "[::1]:4100"),
        fc.constantFrom("example.com:4100", "evil.example", "127.0.0.1", "a@127.0.0.1:4100", "127.0.0.1:0"),
        fc.constantFrom("http", "https", "HTTP"),
        (own, foreign, scheme) => {
          expect(localAllowed(req(own, "none"), "127.0.0.1", `${scheme}://${foreign}/x`), foreign).toBe(false);
          expect(localAllowed(req(foreign, "none"), "127.0.0.1", `${scheme}://${own}/x`), own).toBe(true);
          expect(localAllowed(req(own, "none"), "127.0.0.1", "/x")).toBe(true);
          expect(localAllowed(req(foreign, "none"), "127.0.0.1", "/x")).toBe(false);
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("refuses a loopback Host or authority with port 0", () => {
    for (const h of ["127.0.0.1:0", "localhost:0", "[::1]:0", "127.0.0.1:00"]) {
      expect(localAllowed(req(h, "none"), "127.0.0.1"), h).toBe(false);
      expect(localAllowed(req("127.0.0.1:4100", "none"), "127.0.0.1", `http://${h}/x`), h).toBe(false);
    }
  });
});
