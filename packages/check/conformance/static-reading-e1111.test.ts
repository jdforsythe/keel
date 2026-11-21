// Spec: k.contract, Static reading "Keys are literal; the entries and each entry are object literals in the call, `method`, `path`, `layout` and `events` literals, `params`, `search` and `query` schemas read through consts and imports, other members any expression. A spread, call or name there (a const object's too) is W1005 and E1111 at it; the entries beside it are read."
// Spec: k.privacy, Rules "E1111 ... or a route table, entry, `params` or `search` it cannot read statically (a factory call, a computed key)"
// This file covers the E1111 half (the W1005 half is in @keel/compiler's conformance).
// Examples only: fixed projects. No random inputs (a fast-check seed would be 1337).
import { check } from "@keel/check";
import { describe, expect, test } from "vitest";

const f = (path: string, source: string) => ({ path, source });
const MANIFEST = f(
  "modules/app/module.ts",
  "import { module } from '@keel/compiler'\nexport default module({ id: 'app', deps: [], capabilities: [], public: { exports: [] } })\n",
);
const HEAD = "import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\n";
const run = (contractTs: string, extra: ReturnType<typeof f>[] = []) => {
  const files = [MANIFEST, f("modules/app/app.contract.ts", contractTs), ...extra];
  const lines = (p: string) => files.find((x) => x.path === p)?.source.split("\n") ?? [];
  return check(files, { types: false })
    .diagnostics.filter((d) => d.code === "E1111")
    .map((d) => ({ ...d, text: (lines(d.path)[d.line - 1] ?? "").slice(d.col - 1) }));
};
const bad = "s.object({ q: s.string().pii('contact') })";

describe("k.contract Static reading, E1111 from check", () => {
  test("a spread in place of a contract's entries is one E1111 at the spread, with the entries beside it still read", () => {
    const d = run(
      `${HEAD}declare const more: () => Record<string, never>\nexport const app = contract('app', {\n  ...more(),\n  'app.find': { method: 'GET', path: '/find', query: ${bad}, output: s.object({}) },\n})\n`,
    );
    expect(d).toHaveLength(2);
    expect(d.filter((x) => x.text.startsWith("...more()"))).toHaveLength(1);
    expect(d.filter((x) => x.text.startsWith("query:"))).toHaveLength(1);
  });

  test("a call in place of a contract's entries is one E1111 at the call", () => {
    const d = run(
      `${HEAD}declare const entries: () => Record<string, never>\nexport const app = contract('app', entries())\n`,
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.text.startsWith("entries()")).toBe(true);
  });

  test("a spread in place of one entry is one E1111 at the spread, with the other entries still read", () => {
    const d = run(
      `${HEAD}const base = { method: 'GET' } as const\nexport const app = contract('app', {\n  'app.a': { ...base, path: '/a' },\n  'app.find': { method: 'GET', path: '/find', query: ${bad}, output: s.object({}) },\n})\n`,
    );
    expect(d.filter((x) => x.text.startsWith("...base"))).toHaveLength(1);
    expect(d.filter((x) => x.text.startsWith("query:"))).toHaveLength(1);
  });

  test("a call in place of one entry is one E1111 at the call, with the other entries still read", () => {
    const d = run(
      `${HEAD}declare const mk: () => { path: string }\nexport const app = contract('app', {\n  'app.a': mk(),\n  'app.find': { method: 'GET', path: '/find', query: ${bad}, output: s.object({}) },\n})\n`,
    );
    expect(d.filter((x) => x.text.startsWith("mk()"))).toHaveLength(1);
    expect(d.filter((x) => x.text.startsWith("query:"))).toHaveLength(1);
  });

  test("an entry whose `path` is not a literal is reported the same way (one E1111 at it)", () => {
    const d = run(
      `${HEAD}const base = '/a'\nexport const app = contract('app', {\n  'app.a': { method: 'GET', path: base + '/x', output: s.object({}) },\n  'app.find': { method: 'GET', path: '/find', query: ${bad}, output: s.object({}) },\n})\n`,
    );
    expect(d.filter((x) => x.text.startsWith("path:") || x.text.startsWith("base"))).toHaveLength(1);
    expect(d.filter((x) => x.text.startsWith("query:"))).toHaveLength(1);
  });

  test("an entry whose `method` is not a literal is reported the same way (one E1111 at it)", () => {
    const d = run(
      `${HEAD}declare const verb: 'GET' | 'POST'\nexport const app = contract('app', {\n  'app.a': { method: verb, path: '/a', output: s.object({}) },\n  'app.find': { method: 'GET', path: '/find', query: ${bad}, output: s.object({}) },\n})\n`,
    );
    expect(d.filter((x) => x.text.startsWith("method:") || x.text.startsWith("verb"))).toHaveLength(1);
    expect(d.filter((x) => x.text.startsWith("query:"))).toHaveLength(1);
  });

  test("a `.pii()` in a `query` schema reached through a const is E1111 at the `query`", () => {
    const d = run(
      `${HEAD}const Q = ${bad}\nexport const app = contract('app', { 'app.find': { method: 'GET', path: '/find', query: Q, output: s.object({}) } })\n`,
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.text.startsWith("query:")).toBe(true);
  });

  test("a `.pii()` in a `query` schema reached through an import is E1111 at the `query`", () => {
    const d = run(
      `${HEAD}import { Q } from './Q.schema.ts'\nexport const app = contract('app', { 'app.find': { method: 'GET', path: '/find', query: Q, output: s.object({}) } })\n`,
      [f("modules/app/Q.schema.ts", `import { s } from '@keel/schema'\nexport const Q = ${bad}\n`)],
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.text.startsWith("query:")).toBe(true);
  });

  test("a call in `output` or `body` is read: no E1111 for any other member being an expression", () => {
    const d = run(
      `${HEAD}declare const wrap: <T>(t: T) => T\nexport const app = contract('app', { 'app.a': { method: 'POST', path: '/a', body: wrap(s.object({})), output: wrap(s.object({})) } })\n`,
    );
    expect(d).toEqual([]);
  });
});
