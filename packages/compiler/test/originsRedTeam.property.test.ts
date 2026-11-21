// k.origins after the D66 red-team pass: a deployable the static read cannot take whole is E1552 and carries no
// origins; the generated entries carry the static read's declaration; a reason holds a visible character and no
// control or format character; an IPv6 literal is E1590; a directive written twice is E1591; a `frame` origin that is
// the app's own at build is E1590. Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { declaredOrigins } from "../src/hosting/declaredOrigins.ts";
import { isExactOrigin } from "../src/hosting/isExactOrigin.ts";
import { isOriginReason } from "../src/hosting/isOriginReason.ts";
import { originsProblem } from "../src/hosting/originsProblem.ts";
import { ownFrameProblems } from "../src/hosting/ownFrameProblems.ts";
import { topologyReadProblems } from "../src/hosting/topologyReadProblems.ts";
import { devEntryCode } from "../src/internal/devEntryCode.ts";
import { parseTopology } from "../src/internal/parseTopology.ts";
import { serverEntryCode } from "../src/internal/serverEntryCode.ts";

const SEED = 1337;
const EVIL = "https://evil.example";
const wrap = (body: string): string =>
  `import { topology } from '@keel/server'\nexport default topology({ ${body} })\n`;
const web = (fields: string): string => wrap(`web: { modules: ['a'], adapter: 'node', ${fields} }`);
const withOrigins = (origins: string): string => web(`origins: ${origins}`);

describe("a deployable the static read cannot take whole", () => {
  const forms = [
    `...{ origins: { connect: { '${EVIL}': 'x' } } }`,
    "...shared",
    `['origins']: { connect: { '${EVIL}': 'x' } }`,
    `[key]: 'postgres'`,
    `origins: {}, origins: { connect: { '${EVIL}': 'x' } }`,
    `storage: 'file', storage: 'postgres'`,
  ];
  test("a spread, a computed key or a key written twice is one E1552, and no origin is read", () => {
    for (const f of forms) {
      const source = web(f);
      expect(
        topologyReadProblems(source).map(([c, d]) => [c, d]),
        f,
      ).toEqual([["E1552", "web"]]);
      expect(parseTopology(source).topology.web?.origins, f).toBeUndefined();
    }
  });
  test("a deployable name written twice is one E1552", () => {
    const source = wrap(`web: { modules: ['a'], adapter: 'node' }, web: { modules: ['b'], adapter: 'node' }`);
    expect(topologyReadProblems(source).map(([c]) => c)).toEqual(["E1552"]);
    expect(parseTopology(source).topology.web?.modules).toEqual(["a"]);
  });
  test("a plain declaration carries its origins on the static topology, in declaration order", () => {
    const origin = fc.stringMatching(/^[a-z]{1,8}$/).map((h) => `https://${h}.example`);
    fc.assert(
      fc.property(fc.uniqueArray(origin, { minLength: 1, maxLength: 16 }), (list) => {
        const source = withOrigins(`{ img: { ${list.map((o) => `'${o}': 'r'`).join(", ")} } }`);
        expect(topologyReadProblems(source)).toEqual([]);
        expect(Object.keys(parseTopology(source).topology.web?.origins?.img ?? {})).toEqual(list);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
});

describe("the generated entries carry the static read's declaration", () => {
  test("serverEntryCode hands start the origins as JSON; with none, `{}`", () => {
    const origins = { web: { img: { "https://a.example": "r" } } };
    expect(serverEntryCode("/p", "web", [], "file", origins)).toContain(
      `start({ topology, origins: ${JSON.stringify(origins)}, deployable: "web"`,
    );
    expect(serverEntryCode("/p", "web", [])).toContain("start({ topology, origins: {}, deployable");
  });
  test("devEntryCode hands each createApp the static topology's origins, never reading the runtime value's", () => {
    const top = parseTopology(web(`...{ origins: { connect: { '${EVIL}': 'x' } } }`)).topology;
    const code = devEntryCode("/p", top);
    expect(code).toContain("createApp({ topology, origins: {}, deployable");
    expect(code).not.toContain(EVIL);
    const plain = parseTopology(withOrigins("{ frame: { 'https://v.example': 'r' } }")).topology;
    expect(devEntryCode("/p", plain)).toContain(`origins: {"web":{"frame":{"https://v.example":"r"}}}`);
  });
});

describe("a reason", () => {
  const visible = fc.stringMatching(/^[a-z]{1,40}$/);
  const refused = fc.constantFrom("\u0000", "\t", "‮", "​", "⁦", "\u0085", " ", "\u001b", "﻿");
  test("with a control or format character anywhere is refused, by the static read and at run time", () => {
    fc.assert(
      fc.property(visible, refused, fc.nat(40), (r, c, at) => {
        const reason = `${r.slice(0, at)}${c}${r.slice(at)}`;
        expect(isOriginReason(reason)).toBe(false);
        expect(originsProblem("web", { img: { "https://a.example": reason } })).toMatch(/^E1590 web: /);
        expect(isOriginReason(r)).toBe(true);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
  test("of blank-set characters only is refused (no visible character)", () => {
    for (const r of [" ", " ", "　", "⠀", "ㅤ", "́"]) expect(isOriginReason(r), r).toBe(false);
    expect(isOriginReason("ok é")).toBe(true);
  });
});

describe("an IPv6 literal origin", () => {
  test("is E1590 with no fix, named as such", () => {
    for (const o of ["https://[::1]", "https://[2001:db8::1]:8443", "http://[::1]:3000"]) {
      expect(isExactOrigin(o), o).toBe(false);
      const problems = declaredOrigins(withOrigins(`{ img: { '${o}': 'r' } }`)).problems;
      expect(
        problems.map(([c, , , , fix]) => [c, fix]),
        o,
      ).toEqual([["E1590", undefined]]);
      expect(originsProblem("web", { img: { [o]: "r" } })).toMatch(/E1590 web: .*/);
    }
    expect(declaredOrigins(withOrigins(`{ img: { 'https://[::1]': 'r' } }`)).problems[0]?.[2]).toContain("IPv6");
  });
});

describe("a directive written twice", () => {
  test("is one E1591 at the second, whose fix removes it; the first is the one read", () => {
    const source = withOrigins(`{ img: { 'https://a.example': 'r' }, img: { '${EVIL}': 'r' } }`);
    const problems = declaredOrigins(source).problems;
    expect(problems.map(([c]) => c)).toEqual(["E1591"]);
    expect(declaredOrigins(source).origins).toEqual({ web: { img: { "https://a.example": "r" } } });
    const fix = problems[0]?.[4];
    const fixed = fix === undefined ? source : source.slice(0, fix.start) + fix.text + source.slice(fix.end);
    expect(declaredOrigins(fixed).problems).toEqual([]);
    expect(fixed).not.toContain(EVIL);
  });
});

describe("a frame of the app's own origin at build", () => {
  const top = (frame: string) =>
    parseTopology(
      wrap(
        `api: { modules: ['b'], adapter: 'node' }, web: { modules: ['a'], adapter: 'client', origins: { frame: { '${frame}': 'r' } } }`,
      ),
    ).topology;
  test("equal to a KEEL_PEER_<NAME> or KEEL_ORIGIN is E1590 naming the key, never its value", () => {
    expect(ownFrameProblems(top("https://api.example"), { KEEL_PEER_API: "https://api.example/" })).toEqual([
      ["web", "web: origins.frame: https://api.example is the app's own origin (KEEL_PEER_API)"],
    ]);
    expect(ownFrameProblems(top("https://shop.example"), { KEEL_ORIGIN: "https://shop.example" })[0]?.[1]).toContain(
      "(KEEL_ORIGIN)",
    );
    expect(ownFrameProblems(top("https://v.example"), { KEEL_PEER_API: "https://api.example" })).toEqual([]);
    expect(ownFrameProblems(top("https://api.example"), {})).toEqual([]);
  });
});
