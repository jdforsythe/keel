// k.privacy, URLs "a marked or `s.secret` node in a route's `params`, `search` or `query` schema is E1111: a path or query reaches history and proxy logs Keel cannot redact."
// Seed: 1337.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, it } from "vitest";
import type { Files } from "./support.ts";
import { SEED } from "./support.ts";

const f = (path: string, source: string): Files[number] => ({ path, source });
const MANIFEST = f(
  "modules/app/module.ts",
  `import { module } from '@keel/compiler'\nexport default module({ id: 'app', deps: [], capabilities: [], public: { exports: [] } })\n`,
);
const e1111 = (files: Files) =>
  check([MANIFEST, ...files], { types: false }).diagnostics.filter((d) => d.code === "E1111");

const CLASSES = ["name", "contact", "location", "identifier", "financial", "special", "network", "content"] as const;
const api = (query: string): Files[number] =>
  f(
    "modules/app/app.contract.ts",
    `import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\n` +
      `export const app = contract('app', {\n  'app.find': { method: 'GET', path: '/api/find', query: ${query}, output: s.object({}) },\n})\n`,
  );

it("a marked field in an API entry's `query` schema is E1111, for every class, and not in its unmarked twin", () => {
  fc.assert(
    fc.property(fc.constantFrom(...CLASSES), (cls) => {
      const ds = e1111([api(`s.object({ q: s.string().pii('${cls}') })`)]);
      expect(ds).toHaveLength(1);
      expect(ds[0]?.fix).toBeUndefined();
      expect(e1111([api("s.object({ q: s.string() })")])).toHaveLength(0);
    }),
    { seed: SEED, numRuns: 30 },
  );
});

it("an `s.secret` field in an API entry's `query` schema is E1111", () => {
  expect(e1111([api("s.object({ token: s.secret(s.string()) })")])).toHaveLength(1);
});
