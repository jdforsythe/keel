// Spec: k.shared, clause "In `modules/p/load.server.ts`, `last.set(x)` inside a function, `last` imported from `./last.ts`, is one E1256 at the call with no fix; the same call at the file's top level, `const s = signal(0); s.set(1)` inside a loader's function, and the call in `modules/p/Panel.tsx` (no handler, not a server file) are none."
// Spec: k.shared, clause "In `modules/p/load.server.ts`, inside a function, each of `count++` and `count = 1` (`let count = 0` at the top level), `cache.set(k, v)` (`const cache = new Map()`), `seen.push(x)` (`const seen: string[] = []`) and `conf.mode = 'x'` (`const conf = { mode: '' }`) is one E1260 at the write; `cache.get(k)`, `pool.set(k, v)` with `const pool = processSlot('p.pool', () => new Map())`, `count = 1` at the top level, and each of these in `modules/p/Panel.tsx` are none."
// Seed 1337. E1260's clause names `processSlot` (RFC 0251, another lane): the `pool.set` case imports it from `@keel/ctx`; where it does not exist yet that case fails for want of the export, which the builder reads as waiting on that lane.
import { check } from "@keel/check";
import { expect, test } from "vitest";
import { type Files, manifestFile } from "./module-support.ts";
import { at } from "./rules-support.ts";

const MANIFEST = manifestFile({ id: "p", deps: [], capabilities: [], exports: [] });
const LAST: Files[number] = {
  path: "modules/p/last.ts",
  source: "import { signal } from '@keel/reactive'\nexport const last = signal('')\n",
};
const SERVER = "modules/p/load.server.ts";
const PANEL = "modules/p/Panel.tsx";
const run = (path: string, source: string, extra: Files = [LAST]) =>
  check([MANIFEST, ...extra, { path, source }], { types: false }).diagnostics;
const of = (ds: ReturnType<typeof run>, code: string) => ds.filter((d) => d.code === code);

test("`last.set(x)` inside a function in modules/p/load.server.ts is one E1256 at the call with no fix", () => {
  const src = "import { last } from './last.ts'\ndeclare const x: string\nexport function load() { last.set(x) }\n";
  const ds = of(run(SERVER, src), "E1256");
  expect(ds).toHaveLength(1);
  expect(ds[0]?.fix).toBeUndefined();
  expect(ds[0]?.message).toBe(
    "module signal last set in server code: keep per-request state in the request scope",
  );
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(src, "last.set"));
});

test("the same call at the file's top level is no E1256", () => {
  expect(of(run(SERVER, "import { last } from './last.ts'\nlast.set('x')\n"), "E1256")).toEqual([]);
});

test("`const s = signal(0); s.set(1)` inside a loader's function is no E1256", () => {
  const src = "import { signal } from '@keel/reactive'\nexport function load() { const s = signal(0); s.set(1) }\n";
  expect(of(run(SERVER, src), "E1256")).toEqual([]);
});

test("the call in modules/p/Panel.tsx (no handler, not a server file) is no E1256", () => {
  const src = "import { last } from './last.ts'\nexport function Panel() { last.set('x'); return null }\n";
  expect(of(run(PANEL, src), "E1256")).toEqual([]);
});

const WRITES: readonly (readonly [string, string])[] = [
  ["count++", "let count = 0"],
  ["count = 1", "let count = 0"],
  ["cache.set(k, v)", "const cache = new Map<string, string>()"],
  ["seen.push(x)", "const seen: string[] = []"],
  ["conf.mode = 'x'", "const conf = { mode: '' }"],
];
const DECLS = "declare const k: string\ndeclare const v: string\ndeclare const x: string\n";
const MESSAGE =
  "module state written in server code: per request use the request's scope, per process use processSlot(name, make)";
for (const [write, decl] of WRITES) {
  test(`\`${write}\` inside a function in a server file (\`${decl}\` at the top level) is one E1260 at the write, with no fix`, () => {
    const src = `${DECLS}${decl}\nexport function load() { ${write} }\n`;
    const ds = of(run(SERVER, src, []), "E1260");
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toBe(MESSAGE);
    expect(ds[0]?.fix).toBeUndefined();
    expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(src, write, "export function load"));
  });
  test(`\`${write}\` in modules/p/Panel.tsx is no E1260`, () => {
    const src = `${DECLS}${decl}\nexport function Panel() { ${write}; return null }\n`;
    expect(of(run(PANEL, src, []), "E1260")).toEqual([]);
  });
}

test("`cache.get(k)`, `pool.set(k, v)` over a processSlot, and `count = 1` at the top level are no E1260", () => {
  const reads = `${DECLS}const cache = new Map<string, string>()\nexport function load() { return cache.get(k) }\n`;
  expect(of(run(SERVER, reads, []), "E1260")).toEqual([]);
  const pool = `import { processSlot } from '@keel/ctx'\n${DECLS}const pool = processSlot('p.pool', () => new Map<string, string>())\nexport function load() { pool.set(k, v) }\n`;
  expect(of(run(SERVER, pool, []), "E1260")).toEqual([]);
  expect(of(run(SERVER, "let count = 0\ncount = 1\n", []), "E1260")).toEqual([]);
});
