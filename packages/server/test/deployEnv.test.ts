// @vitest-environment node
// `DeployEnv` (k.topology Build): `KEEL_PEER_<NAME>` is an absolute http(s) URL; anything else fails on that key
// (path and rule only), which `start` prints as one E1560 line. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DeployEnv } from "../src/internal/DeployEnv.ts";

const SEED = 1337;
const SECRET = "s".repeat(32);

describe("DeployEnv peers", () => {
  it("accepts an absolute http or https URL", () => {
    for (const url of ["http://api:8080", "https://api.example.com", "http://10.0.0.2:3000/"]) {
      const r = DeployEnv(["api"]).decodeStrings({ KEEL_SECRET: SECRET, KEEL_PEER_API: url });
      expect(r.ok, url).toBe(true);
    }
  });

  it("refuses any value that is not an absolute http(s) URL, naming the key", () => {
    const bad = fc.oneof(
      fc.constantFrom("api:8080", "api", "/api", "//api:8080", "ftp://api", "file:///etc/passwd", "http://"),
      fc.string().filter((v) => {
        const u = URL.canParse(v) ? new URL(v) : undefined;
        return u === undefined || (u.protocol !== "http:" && u.protocol !== "https:");
      }),
    );
    fc.assert(
      fc.property(bad, (value) => {
        const r = DeployEnv(["api"]).decodeStrings({ KEEL_SECRET: SECRET, KEEL_PEER_API: value });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.data.issues[0]?.path).toEqual(["KEEL_PEER_API"]);
        expect(["format", "min", "required"]).toContain(r.error.data.issues[0]?.rule);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });
});

describe("DeployEnv KEEL_SECRET", () => {
  it("accepts a secret of 32 or more UTF-8 bytes and refuses a shorter one, whatever its character count", () => {
    const chars = fc.constantFrom("a", "é", "€", "😀");
    fc.assert(
      fc.property(fc.array(chars, { maxLength: 40 }), (parts) => {
        const secret = parts.join("");
        const r = DeployEnv([]).decodeStrings({ KEEL_SECRET: secret });
        expect(r.ok).toBe(new TextEncoder().encode(secret).length >= 32);
        if (!r.ok) expect(r.error.data.issues[0]?.path).toEqual(["KEEL_SECRET"]);
      }),
      { seed: SEED, numRuns: 300 },
    );
  });
});

describe("DeployEnv KEEL_ORIGIN", () => {
  it("reads only whitespace as unset", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[ \t\n]{1,6}$/), (blank) => {
        const r = DeployEnv([]).decodeStrings({ KEEL_SECRET: SECRET, KEEL_ORIGIN: blank });
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.value.KEEL_ORIGIN).toBeUndefined();
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
});
