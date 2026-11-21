// cspPolicy({ origins }) (k.origins Policy): no declaration is the k.security text, declared origins land in their
// directive in order, and nothing else changes. Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { cspPolicy } from "../src/csp/cspPolicy.ts";

const SEED = 1337;
const origin = fc.stringMatching(/^[a-z]{1,8}$/).map((h) => `https://${h}.example`);
const list = fc.uniqueArray(origin, { maxLength: 16 });
const DIRECTIVES = ["img", "media", "font", "connect", "frame"] as const;
const origins = fc.record(
  Object.fromEntries(DIRECTIVES.map((d) => [d, list.map((os) => Object.fromEntries(os.map((o) => [o, "r"])))])),
  { requiredKeys: [] },
);
const input = fc.oneof(
  fc.record({ nonce: fc.stringMatching(/^[A-Za-z0-9]{8,22}$/), dev: fc.boolean() }),
  fc.record({ peers: fc.uniqueArray(origin, { maxLength: 4 }) }),
);
const split = (p: string): string[] => p.split("; ");
const named = (p: string, name: string): string | undefined => split(p).find((d) => d.split(" ")[0] === name);

describe("cspPolicy with declared origins", () => {
  test("no declaration, and directives with no origin, give the k.security policy byte for byte", () => {
    fc.assert(
      fc.property(input, (i) => {
        const plain = cspPolicy(i);
        expect(cspPolicy({ ...i, origins: {} })).toBe(plain);
        expect(cspPolicy({ ...i, origins: { img: {}, media: {}, font: {}, connect: {}, frame: {} } })).toBe(plain);
        expect(plain).not.toMatch(/media-src|frame-src/);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  test("each directive holds its declared origins in order; media and frame without 'self', after connect-src", () => {
    fc.assert(
      fc.property(input, origins, (i, o) => {
        const p = cspPolicy({ ...i, origins: o });
        const peers = "peers" in i ? i.peers : [];
        for (const d of ["img", "font"] as const)
          expect(named(p, `${d}-src`)).toBe([`${d}-src 'self'`, ...Object.keys(o[d] ?? {})].join(" "));
        expect(named(p, "connect-src")).toBe(
          ["connect-src 'self'", ...new Set([...peers, ...Object.keys(o.connect ?? {})])].join(" "),
        );
        const ds = split(p).map((d) => d.split(" ")[0]);
        const after = ds.slice(ds.indexOf("connect-src") + 1, ds.indexOf("manifest-src"));
        const extra = (["media", "frame"] as const).filter((d) => Object.keys(o[d] ?? {}).length > 0);
        expect(after).toEqual(extra.map((d) => `${d}-src`));
        for (const d of extra) expect(named(p, `${d}-src`)).toBe([`${d}-src`, ...Object.keys(o[d] ?? {})].join(" "));
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  test("every directive k.security emits that takes no declaration is unchanged", () => {
    fc.assert(
      fc.property(input, origins, (i, o) => {
        const fixed = split(cspPolicy(i)).filter((d) => !/^(img|font|connect)-src /.test(d));
        const widened = split(cspPolicy({ ...i, origins: o }));
        for (const d of fixed) expect(widened).toContain(d);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
