// Properties of the `x-keel-user` value `callerSigner` makes and reads (k.user Across deployables, User header). Seed 1337.
// @vitest-environment node
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { callerSigner } from "../src/internal/callerSigner.ts";

const SECRET = "unit-secret-user-0123456789abcdef0123456789abcdef";
const NONE = new Uint8Array(0);
const bytes = (text: string) => new TextEncoder().encode(text);
const at = (url: string, header: string, method = "GET") =>
  new Request(url, { method, headers: { "x-keel-user": header } });

describe("x-keel-user", () => {
  it("reads back the user it signed for the same method, path, search, body and deployable until 60 s after signing", async () => {
    const keys = await callerSigner(SECRET, "b");
    await fc.assert(
      fc.property(
        fc.string({ maxLength: 256 }),
        fc.string(),
        fc.integer({ min: 0, max: 1e12 }),
        fc.nat({ max: 60_000 }),
        (user, body, now, later) => {
          const h = keys.assert("POST", "http://b.test/b/1?q=2", user, "b", body, now) ?? "";
          const req = () => at("http://b.test/b/1?q=2", h, "POST");
          expect(keys.user(req(), now + later, bytes(body))).toBe(user);
          expect(keys.user(req(), now + 60_001, bytes(body))).toBeUndefined();
          expect(keys.user(req(), now + later, bytes(`${body}x`))).toBeUndefined();
        },
      ),
      { seed: 1337, numRuns: 50 },
    );
  });

  it("ignores the value at another path, search, method, deployable, body or secret, and any one-character change", async () => {
    const keys = await callerSigner(SECRET, "b");
    const c = await callerSigner(SECRET, "c");
    const other = await callerSigner(`${SECRET}x`, "b");
    const h = keys.assert("GET", "http://b.test/b/1", "u1", "b", "", 0) ?? "";
    expect(keys.user(at("http://b.test/b/1", h), 0, NONE)).toBe("u1");
    expect(keys.user(at("http://b.test/b/2", h), 0, NONE)).toBeUndefined();
    expect(keys.user(at("http://b.test/b/1?x=1", h), 0, NONE)).toBeUndefined();
    expect(keys.user(at("http://b.test/b/1", h, "POST"), 0, NONE)).toBeUndefined();
    expect(keys.user(at("http://b.test/b/1", h), 0, bytes("{}"))).toBeUndefined();
    expect(c.user(at("http://b.test/b/1", h), 0, NONE)).toBeUndefined();
    expect(other.user(at("http://b.test/b/1", h), 0, NONE)).toBeUndefined();
    await fc.assert(
      fc.property(fc.nat({ max: h.length - 1 }), fc.constantFrom("A", "0", ".", "-"), (i, ch) => {
        fc.pre(h[i] !== ch);
        expect(keys.user(at("http://b.test/b/1", `${h.slice(0, i)}${ch}${h.slice(i + 1)}`), 0, NONE)).toBeUndefined();
      }),
      { seed: 1337, numRuns: 100 },
    );
  });

  it("accepts an expiry at most 65 s ahead of the receiver's clock and ignores one further ahead", async () => {
    const keys = await callerSigner(SECRET);
    await fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e12 }), fc.integer({ min: -60_000, max: 60_000 }), (now, lead) => {
        const h = keys.assert("GET", "http://b.test/", "u1", "", "", now + lead) ?? "";
        const got = keys.user(at("http://b.test/", h), now, NONE);
        expect(got).toBe(lead <= 5_000 ? "u1" : undefined);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });

  it("refuses to sign a user over 256 characters, and ignores one", async () => {
    const keys = await callerSigner(SECRET);
    await fc.assert(
      fc.property(fc.constantFrom("a", "é", "😀"), (ch) => {
        expect(keys.assert("GET", "http://b.test/", ch.repeat(256), "", "", 0)).toBeDefined();
        expect(keys.assert("GET", "http://b.test/", ch.repeat(257), "", "", 0)).toBeUndefined();
      }),
      { seed: 1337, numRuns: 3 },
    );
  });

  it("gives no user for a request without the header or with a malformed one", async () => {
    const keys = await callerSigner(SECRET);
    expect(keys.user(new Request("http://b.test/"), 0, NONE)).toBeUndefined();
    for (const bad of ["", ".", "..", "dTE.1.", "dTE..x", "dTE.1.2.3", "dTE=.1.x"])
      expect(keys.user(at("http://b.test/", bad), 0, NONE)).toBeUndefined();
  });
});
