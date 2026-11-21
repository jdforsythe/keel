// identityMount refuses a path that is not lowercase `/` segments at run time (k.mount Rules E1580), so a `vite build`
// alone or a direct call never makes a mount an off-origin URL. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { identityMount } from "../src/identityMount.ts";

const SEED = 1337;
const codeOf = (run: () => unknown): unknown => {
  try {
    run();
    return null;
  } catch (e) {
    return e instanceof Error && "code" in e ? e.code : "none";
  }
};

describe("identityMount path", () => {
  it("refuses a path that a URL parser reads as naming a host, or that is not lowercase / segments, with E1580", () => {
    for (const bad of [
      "/\\evil.example",
      "/\t/evil.example",
      "//x.example",
      "",
      "/",
      "api",
      "/API",
      "/a/",
      "/a b",
      "/a?b",
    ])
      expect(codeOf(() => identityMount(bad))).toBe("E1580");
  });

  it("every string that is not lowercase `/` segments throws E1580, every one that is gives its own path", () => {
    const segment = fc.stringMatching(/^[a-z0-9-]{1,6}$/);
    const good = fc.array(segment, { minLength: 1, maxLength: 3 }).map((p) => p.map((x) => `/${x}`).join(""));
    fc.assert(
      fc.property(good, (p) => identityMount(p).path === p),
      { seed: SEED, numRuns: 100 },
    );
    const bad = fc.string({ maxLength: 12 }).filter((v) => !/^(\/[a-z0-9-]+)+$/.test(v));
    fc.assert(
      fc.property(bad, (p) => codeOf(() => identityMount(p)) === "E1580"),
      { seed: SEED, numRuns: 300 },
    );
  });
});
