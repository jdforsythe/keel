// Spec: k.mount-scope (rfc:0156), Test "`identityMount` throws E1580 for any `path` that is not lowercase `/` segments."
// Spec: rfc:0156, clause "`identityMount(p)` throws E1580 for each of `'/\evil.example'`, `'//x.example'`, `''`, `'/'`, `'api'`, `'/API'`, `'/a/'`, `'/a b'`, `'/a?b'`; `identityMount('/api/auth').path` is `'/api/auth'`."
// Seed 1337 (fc.assert below).
import { identityMount } from "@keel/router";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, thrownCode } from "./mount-support.ts";

describe("k.mount: identityMount(path) refuses a path that is not lowercase / segments", () => {
  it("identityMount throws E1580 for '/\\evil.example', '//x.example', '', '/', 'api', '/API', '/a/', '/a b' and '/a?b'", () => {
    for (const path of ["/\\evil.example", "//x.example", "", "/", "api", "/API", "/a/", "/a b", "/a?b"]) {
      expect(
        thrownCode(() => identityMount(path)),
        JSON.stringify(path),
      ).toBe("E1580");
    }
  });

  it("identityMount('/api/auth').path is '/api/auth'", () => {
    expect(identityMount("/api/auth").path).toBe("/api/auth");
  });

  it("for generated paths holding an uppercase letter, a space, a backslash or a ? the call throws E1580", () => {
    const bad = fc.constantFrom("A", "Z", " ", "\\", "?", "#");
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{1,6}$/), bad, (seg, ch) => {
        expect(thrownCode(() => identityMount(`/${seg}${ch}x`))).toBe("E1580");
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
});
