// Properties of identityMount (k.mount Declaration): the result of every accepted subpath is a root-relative path
// under the mount, the search map's encoding round-trips, and every refused subpath throws E1582. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { identityMount } from "../src/identityMount.ts";

const SEED = 1337;
const mount = identityMount("/auth");
const codeOf = (run: () => unknown): unknown => {
  try {
    run();
    return null;
  } catch (e) {
    return e instanceof Error && "code" in e ? e.code : "none";
  }
};
const segment = fc.stringMatching(/^[\w.~-]{1,6}$/).filter((v) => v !== "." && v !== "..");
const sub = fc.array(segment, { maxLength: 4 }).map((p) => p.map((x) => `/${x}`).join(""));

describe("identityMount", () => {
  it("an accepted subpath and search map give path, subpath and the sorted, encoded query", () => {
    fc.assert(
      fc.property(sub, fc.dictionary(fc.string({ maxLength: 4 }), fc.string({ maxLength: 4 })), (s, map) => {
        const out = mount.href(s, map);
        const url = new URL(out, "http://x.test");
        expect(url.origin).toBe("http://x.test");
        expect(url.pathname).toBe(`/auth${s}`);
        expect(Object.fromEntries(url.searchParams)).toEqual(map);
        expect([...url.searchParams.keys()]).toEqual(Object.keys(map).sort());
        expect(out.includes("?")).toBe(Object.keys(map).length > 0);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("a subpath with a character outside the set, an empty, `.` or `..` segment, or no leading `/` throws E1582", () => {
    const bad = fc.oneof(
      fc.tuple(sub, fc.constantFrom("?", "#", "%", "\\", ":", " ", "é", "/", "/.", "/..")).map(([s, c]) => `${s}${c}`),
      segment,
    );
    fc.assert(
      fc.property(bad, (s) => {
        expect(codeOf(() => mount.href(s))).toBe("E1582");
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("keeps the path as written and `href()` is the path alone", () => {
    expect(mount.path).toBe("/auth");
    expect(mount.href()).toBe("/auth");
    expect(mount.href("/a..b/.c")).toBe("/auth/a..b/.c");
  });
});
