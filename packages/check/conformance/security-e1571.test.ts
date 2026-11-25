// Spec: k.security, clause "`ctx.net.fetch(new Request('https://api.example/x'))` in a client-reachable file is E1571; in a `*.server.ts` file it is not."
// k.security, Rules "E1571 a literal absolute `http(s)` URL given to `ctx.net.fetch` or `service({ base })` in client-reachable code (E1004's reachability)."
// Seed: 1337.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED } from "./support.ts";

const FETCH = (url: string): string =>
  `import type { Ctx } from '@keel/ctx'\nexport const load = (ctx: Ctx) => ctx.net.fetch(new Request(${JSON.stringify(url)}))\n`;

const SCHEMA = {
  path: "api.schema.ts",
  source: `import { endpoints } from '@keel/services'\nimport { s } from '@keel/schema'\nexport const api = endpoints({ get: { method: 'GET', path: '/x', output: s.json() } })\n`,
};
const SERVICE = (base: string): string =>
  `import { service } from '@keel/services'\nimport { api } from './api.schema.ts'\nexport const remote = service({ base: ${JSON.stringify(base)}, schema: api })\n`;

const codes = (files: { path: string; source: string }[]) =>
  check(files, { types: false }).diagnostics.filter((d) => d.code === "E1571");

const host = fc.stringMatching(/^[a-z]{3,10}$/);
const scheme = fc.constantFrom("http", "https");

describe("k.security: E1571", () => {
  test("`ctx.net.fetch(new Request('https://api.example/x'))` in a client-reachable file is E1571", () => {
    expect(codes([{ path: "load.ts", source: FETCH("https://api.example/x") }])).toHaveLength(1);
  });

  test("`ctx.net.fetch(new Request('https://api.example/x'))` in a `*.server.ts` file is not E1571", () => {
    expect(codes([{ path: "load.server.ts", source: FETCH("https://api.example/x") }])).toEqual([]);
  });

  test("E1571: a relative URL given to `ctx.net.fetch` in a client-reachable file is not reported", () => {
    expect(codes([{ path: "load.ts", source: FETCH("/orders") }])).toEqual([]);
  });

  test("property: any literal absolute http(s) URL given to `ctx.net.fetch` is E1571 in client-reachable code only", () => {
    fc.assert(
      fc.property(scheme, host, (sch, h) => {
        const url = `${sch}://${h}.example/x`;
        expect(codes([{ path: "load.ts", source: FETCH(url) }])).toHaveLength(1);
        expect(codes([{ path: "load.server.ts", source: FETCH(url) }])).toEqual([]);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  test("E1571: a literal absolute http(s) `service({ base })` in client-reachable code is reported, in a `*.server.ts` file it is not", () => {
    fc.assert(
      fc.property(scheme, host, (sch, h) => {
        const base = `${sch}://${h}.example`;
        expect(codes([SCHEMA, { path: "remote.ts", source: SERVICE(base) }])).toHaveLength(1);
        expect(codes([SCHEMA, { path: "remote.server.ts", source: SERVICE(base) }])).toEqual([]);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("E1571: carries no fix", () => {
    const [d] = codes([{ path: "load.ts", source: FETCH("https://api.example/x") }]);
    expect(d).toBeDefined();
    expect(d?.fix).toBeUndefined();
  });
});
