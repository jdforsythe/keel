// Properties of the `x-keel-user` value `callerSigner` makes and reads (k.user Across deployables). Seed 1337.
// @vitest-environment node
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { callerSigner } from "../src/internal/callerSigner.ts";

const SECRET = "unit-secret-user-0123456789abcdef0123456789abcdef";
const at = (url: string, header: string, method = "GET") =>
  new Request(url, { method, headers: { "x-keel-user": header } });

describe("x-keel-user", () => {
  it("reads back the user it signed for the same method, path and search until 60 s after signing", async () => {
    const keys = await callerSigner(SECRET);
    await fc.assert(
      fc.property(
        fc.string({ maxLength: 256 }),
        fc.integer({ min: 0, max: 1e12 }),
        fc.nat({ max: 60_000 }),
        (user, now, later) => {
          const h = keys.assert("GET", "http://b.test/b/1?q=2", user, now);
          expect(keys.user(at("http://b.test/b/1?q=2", h), now + later)).toBe(user);
          expect(keys.user(at("http://b.test/b/1?q=2", h), now + 60_001)).toBeUndefined();
        },
      ),
      { seed: 1337, numRuns: 50 },
    );
  });

  it("ignores the value at another path, search, method or secret, and any one-character change", async () => {
    const keys = await callerSigner(SECRET);
    const other = await callerSigner(`${SECRET}x`);
    const h = keys.assert("GET", "http://b.test/b/1", "u1", 0);
    expect(keys.user(at("http://b.test/b/2", h), 0)).toBeUndefined();
    expect(keys.user(at("http://b.test/b/1?x=1", h), 0)).toBeUndefined();
    expect(keys.user(at("http://b.test/b/1", h, "POST"), 0)).toBeUndefined();
    expect(other.user(at("http://b.test/b/1", h), 0)).toBeUndefined();
    await fc.assert(
      fc.property(fc.nat({ max: h.length - 1 }), fc.constantFrom("A", "0", ".", "-"), (i, c) => {
        fc.pre(h[i] !== c);
        expect(keys.user(at("http://b.test/b/1", `${h.slice(0, i)}${c}${h.slice(i + 1)}`), 0)).toBeUndefined();
      }),
      { seed: 1337, numRuns: 100 },
    );
  });

  it("gives no user for a request without the header or with a malformed one", async () => {
    const keys = await callerSigner(SECRET);
    expect(keys.user(new Request("http://b.test/"), 0)).toBeUndefined();
    for (const bad of ["", ".", "..", "dTE.1.", "dTE..x", "dTE.1.2.3"])
      expect(keys.user(at("http://b.test/", bad), 0)).toBeUndefined();
  });
});
