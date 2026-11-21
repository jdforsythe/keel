// Spec: k.origins, Conformance "`ctx.net.fetch(new Request('https://c.example/e'))` in a client-reachable file is no E1571 with `connect` declaring `https://c.example`, and E1571 with it under `img` only."
// Spec: k.origins, Rules "`connect` for E1571."
// Seed 1337 (fc.assert below).
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, decl, single, withCode } from "./origins-support.ts";

const FETCH = (url: string): string =>
  `import type { Ctx } from '@keel/ctx'\nexport const load = (ctx: Ctx) => ctx.net.fetch(new Request(${JSON.stringify(url)}))\n`;
const SERVICE = (base: string): string =>
  `import { service } from '@keel/services'\nimport { api } from './api.schema.ts'\nexport const remote = service({ base: ${JSON.stringify(base)}, schema: api })\n`;
const SCHEMA = {
  path: "modules/a/api.schema.ts",
  source: `import { endpoints } from '@keel/services'\nimport { s } from '@keel/schema'\nexport const api = endpoints({ get: { method: 'GET', path: '/x', output: s.json() } })\n`,
};
const e1571 = (origins: string | undefined, files: { path: string; source: string }[]) =>
  withCode(single(origins, files), "E1571");
const LOAD = (src: string) => [{ path: "modules/a/load.ts", source: src }];

describe("k.origins: E1571 at a declared origin", () => {
  test("`ctx.net.fetch(new Request('https://c.example/e'))` in a client-reachable file is no E1571 with `connect` declaring `https://c.example`", () => {
    expect(e1571(decl("connect", "https://c.example"), LOAD(FETCH("https://c.example/e")))).toEqual([]);
  });
  test("`ctx.net.fetch(new Request('https://c.example/e'))` with the origin under `img` only is E1571", () => {
    for (const d of ["img", "media", "font", "frame"]) {
      expect(e1571(decl(d, "https://c.example"), LOAD(FETCH("https://c.example/e")))).toHaveLength(1);
    }
  });
  test("`ctx.net.fetch` of an undeclared origin is E1571 with no declaration and with `connect` naming another origin", () => {
    expect(e1571(undefined, LOAD(FETCH("https://c.example/e")))).toHaveLength(1);
    expect(e1571(decl("connect", "https://d.example"), LOAD(FETCH("https://c.example/e")))).toHaveLength(1);
  });
  test("`service({ base })` at a declared `connect` origin is no E1571, and E1571 under `img` only", () => {
    const files = [SCHEMA, { path: "modules/a/remote.ts", source: SERVICE("https://c.example") }];
    expect(e1571(decl("connect", "https://c.example"), files)).toEqual([]);
    expect(e1571(decl("img", "https://c.example"), files)).toHaveLength(1);
    expect(e1571(undefined, files)).toHaveLength(1);
  });
  test("a declared `connect` origin is no E1571, a relative URL is none, and any other origin is E1571", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{3,10}$/), (h) => {
        const origin = `https://${h}.example`;
        const decls = decl("connect", origin);
        expect(e1571(decls, LOAD(FETCH(`${origin}/e`)))).toEqual([]);
        expect(e1571(decls, LOAD(FETCH(`https://x${h}.test/e`)))).toHaveLength(1);
        expect(e1571(decls, LOAD(FETCH("/e")))).toEqual([]);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});
