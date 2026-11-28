import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { loopbackPeer } from "../src/inspect/loopbackPeer.ts";

const SEED = 1337;
const octet = fc.integer({ min: 0, max: 255 });

describe("loopbackPeer", () => {
  it("is true for ::1, any 127.0.0.0/8 address and its IPv4-mapped form, and false for no connection", () => {
    fc.assert(
      fc.property(octet, octet, octet, fc.boolean(), (a, b, c, mapped) => {
        expect(loopbackPeer(`${mapped ? "::ffff:" : ""}127.${a}.${b}.${c}`)).toBe(true);
      }),
      { seed: SEED, numRuns: 200 },
    );
    expect(loopbackPeer("::1")).toBe(true);
    expect(loopbackPeer("::FFFF:127.0.0.1")).toBe(true);
    expect(loopbackPeer(undefined)).toBe(false);
  });

  it("is false for every address outside 127.0.0.0/8, mapped or not, and for text around a loopback one", () => {
    fc.assert(
      fc.property(
        octet.filter((n) => n !== 127),
        octet,
        octet,
        octet,
        fc.boolean(),
        (a, b, c, d, mapped) => {
          expect(loopbackPeer(`${mapped ? "::ffff:" : ""}${a}.${b}.${c}.${d}`)).toBe(false);
        },
      ),
      { seed: SEED, numRuns: 200 },
    );
    for (const s of ["", "::2", "::", "127.0.0.1.evil", "x127.0.0.1", "::ffff:10.0.0.1", "fe80::1", "127.0.0.1 "])
      expect(loopbackPeer(s), s).toBe(false);
  });
});
