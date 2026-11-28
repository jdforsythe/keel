// k.origins Declaration: the exact-origin and reason rules, the static read (E1590, E1591) and the runtime check. Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { declaredOrigins } from "../src/hosting/declaredOrigins.ts";
import { isExactOrigin } from "../src/hosting/isExactOrigin.ts";
import { isOriginReason } from "../src/hosting/isOriginReason.ts";
import { originOf } from "../src/hosting/originOf.ts";
import { originsProblem } from "../src/hosting/originsProblem.ts";
import { urlOrigin } from "../src/hosting/urlOrigin.ts";

const SEED = 1337;
const label = fc.stringMatching(/^[a-z][a-z0-9]{0,8}$/);
const host = fc.array(label, { minLength: 1, maxLength: 3 }).map((ls) => `${ls.join(".")}.example`);
const port = fc.option(fc.integer({ min: 1, max: 65535 }), { nil: undefined });
const exact = fc.tuple(host, port).map(([h, p]) => `https://${h}${p === undefined || p === 443 ? "" : `:${p}`}`);
const DIRECTIVES = ["img", "media", "font", "connect", "frame"] as const;
const topology = (origins: string): string =>
  `import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['a'], adapter: 'node', origins: ${origins} } })\n`;
const codes = (origins: string): string[] => declaredOrigins(topology(origins)).problems.map(([c]) => c);

describe("isExactOrigin", () => {
  test("an https origin without path is exact, and is its own serialization", () => {
    fc.assert(
      fc.property(exact, (o) => {
        expect(isExactOrigin(o)).toBe(true);
        expect(originOf(o)).toBe(o);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
  test("a path, trailing slash, query, fragment, credentials, wildcard, upper case or http off localhost is not", () => {
    const bad = fc.oneof(
      exact.map((o) => `${o}/`),
      fc.tuple(exact, label).map(([o, p]) => `${o}/${p}`),
      exact.map((o) => `${o}?q`),
      exact.map((o) => `${o}#f`),
      exact.map((o) => o.replace("https://", "https://u@")),
      exact.map((o) => o.replace("https://", "https://*.")),
      exact.map((o) => o.toUpperCase()),
      exact.map((o) => o.replace("https://", "http://")),
    );
    fc.assert(
      fc.property(bad, (o) => {
        expect(isExactOrigin(o)).toBe(false);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });
  test("http is exact on localhost only, with or without a port", () => {
    fc.assert(
      fc.property(port, (p) => {
        expect(isExactOrigin(`http://localhost${p === undefined || p === 80 ? "" : `:${p}`}`)).toBe(true);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
});

describe("isOriginReason", () => {
  test("1 to 200 characters on one line with a visible character", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z ,.]{0,220}$/), (r) => {
        expect(isOriginReason(r)).toBe(r.length >= 1 && r.length <= 200 && /\S/.test(r));
        expect(isOriginReason(`${r.slice(0, 100)}\nx`)).toBe(false);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });
});

describe("declaredOrigins", () => {
  test("exact origins under the five directives read back in declaration order, with no problem", () => {
    fc.assert(
      fc.property(
        fc.subarray([...DIRECTIVES], { minLength: 1 }),
        fc.uniqueArray(exact, { minLength: 1, maxLength: 16 }),
        (ds, os) => {
          const text = `{ ${ds.map((d) => `${d}: { ${os.map((o) => `'${o}': 'r'`).join(", ")} }`).join(", ")} }`;
          const read = declaredOrigins(topology(text));
          expect(read.problems).toEqual([]);
          const [web] = Object.values(read.origins);
          for (const d of ds) expect(Object.keys(web?.[d] ?? {})).toEqual(os);
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });
  test("one origin twice in a directive is one E1591 whose fix removes the second", () => {
    fc.assert(
      fc.property(fc.constantFrom(...DIRECTIVES), exact, (d, o) => {
        const src = topology(`{ ${d}: { '${o}': 'one', '${o}': 'two' } }`);
        const [p] = declaredOrigins(src).problems;
        expect(p?.[0]).toBe("E1591");
        const fix = p?.[4];
        const fixed = fix === undefined ? src : src.slice(0, fix.start) + fix.text + src.slice(fix.end);
        expect(declaredOrigins(fixed).problems).toEqual([]);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
  test("an origin whose serialization is exact gets a fix to it that clears E1590", () => {
    const near = fc.oneof(
      exact.map((o) => [`${o}/`, o]),
      exact.map((o) => [o.replace("https://", "https://X"), o.replace("https://", "https://x")]),
      host.map((h) => [`https://${h}:443`, `https://${h}`]),
    );
    fc.assert(
      fc.property(near, ([given, serial]) => {
        const src = topology(`{ img: { '${given}': 'r' } }`);
        const [p, ...rest] = declaredOrigins(src).problems;
        expect(rest).toEqual([]);
        expect(p?.[0]).toBe("E1590");
        const fix = p?.[4];
        expect(fix?.text).toBe(`'${serial}'`);
        const fixed = fix === undefined ? src : src.slice(0, fix.start) + fix.text + src.slice(fix.end);
        expect(declaredOrigins(fixed).problems).toEqual([]);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
  test("a key outside the five is one E1590", () => {
    fc.assert(
      fc.property(
        label.filter((k) => !DIRECTIVES.some((d) => d === k)),
        (k) => {
          expect(codes(`{ ${k}: { 'https://a.example': 'r' } }`)).toEqual(["E1590"]);
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });
});

describe("originsProblem", () => {
  test("agrees with the static read on a runtime value without duplicates", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DIRECTIVES, "script"),
        fc.oneof(
          exact,
          exact.map((o) => `${o}/`),
        ),
        fc.constantFrom("r", "", "a\nb"),
        (d, o, r) => {
          const runtime = originsProblem("web", { [d]: { [o]: r } });
          const statics = codes(`{ ${d}: { '${o}': ${JSON.stringify(r)} } }`);
          expect(runtime === undefined).toBe(statics.length === 0);
          if (runtime !== undefined) expect(runtime.startsWith("E1590 web: ")).toBe(true);
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  });
});

describe("urlOrigin", () => {
  test("the origin of a URL whose host ends at / ? or #, or at the end of a whole literal", () => {
    fc.assert(
      fc.property(exact, label, (o, p) => {
        expect(urlOrigin(`${o}/${p}`)).toBe(o);
        expect(urlOrigin(`${o}?${p}`)).toBe(o);
        expect(urlOrigin(o)).toBeUndefined();
        expect(urlOrigin(o, true)).toBe(o);
        expect(urlOrigin(`//${o.slice(8)}/x`)).toBeUndefined();
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
