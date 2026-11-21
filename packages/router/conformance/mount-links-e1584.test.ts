// @vitest-environment happy-dom
// Spec: k.mount, clause "`identityMount('/api/auth', { links: ['/verify'] })` is clean, its `links` `['/verify']`; entries `''`, `'verify'`, `'/a?b'`, `'/../x'`, a second `'/verify'` and a variable each give one E1584 under `keel check`, and the call throws E1584 for each literal." (the run-time half; the `keel check` half: packages/check/conformance/mount-links-e1584.test.ts)
// Seed 1337 (fc.assert below).
import { identityMount } from "@keel/router";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, SEGMENT_CHARS, thrownCode } from "./mount-support.ts";

describe("k.mount: identityMount(path, { links })", () => {
  it("identityMount('/api/auth', { links: ['/verify'] }) has links ['/verify'], and links is [] by default", () => {
    expect(identityMount("/api/auth", { links: ["/verify"] }).links).toEqual(["/verify"]);
    expect(identityMount("/api/auth").links).toEqual([]);
    expect(identityMount("/api/auth", {}).links).toEqual([]);
  });

  it("entries '', 'verify', '/a?b', '/../x' and a second '/verify' each throw E1584", () => {
    for (const links of [[""], ["verify"], ["/a?b"], ["/../x"], ["/verify", "/verify"]]) {
      expect(
        thrownCode(() => identityMount("/api/auth", { links })),
        JSON.stringify(links),
      ).toBe("E1584");
    }
  });

  it("every list of distinct subpaths of href's form is accepted, kept in order", () => {
    const segment = fc
      .stringMatching(new RegExp(`^[${SEGMENT_CHARS.replace("-", "\\-")}]{1,8}$`))
      .filter((v) => v !== "." && v !== "..");
    const subpath = fc.array(segment, { minLength: 1, maxLength: 3 }).map((p) => `/${p.join("/")}`);
    fc.assert(
      fc.property(fc.uniqueArray(subpath, { maxLength: 5 }), (links) => {
        expect(identityMount("/api/auth", { links }).links).toEqual(links);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("every entry holding a character outside [A-Za-z0-9._~-] and / throws E1584", () => {
    const bad = fc.constantFrom("?", "#", "%", "\\", ":", " ", "é", "@", "&", "=", "+", ";");
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{1,6}$/), bad, (seg, ch) => {
        expect(thrownCode(() => identityMount("/api/auth", { links: [`/${seg}${ch}x`] }))).toBe("E1584");
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
});
