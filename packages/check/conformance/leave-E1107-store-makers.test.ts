// Spec: k.leave, clause "Let `CHARTS` be a library under `node_modules/@acme/charts/`: `package.json` `{\"name\":\"@acme/charts\",\"version\":\"1.0.0\",\"type\":\"module\",\"keel\":\"library\",\"exports\":{\".\":\"./src/index.ts\"}}`, a `module.ts` with `id: 'charts'`, `deps: []`, `capabilities: []` and `public: { exports: ['chart', 'wrap', 'leaky'] }`, `src/index.ts` `export { chart, wrap, leaky } from './chart.ts'`, and `src/chart.ts`, importing `s` (`@keel/schema`) and `store` (`@keel/store`), holding `export function chart(id: string, spec: { data: unknown; states: string[] }) { const [first, ...rest] = spec.states; return store(s.object({ state: s.enum([first, ...rest]), data: spec.data }), {}, { id }) }`, `export const wrap = (id: string, data: unknown) => chart(id, { data, states: ['a'] })`, `export function leaky(id: string) { const local = make(); return store(s.object({ data: local }), {}, { id }) }` and `function make() { return s.string() }`. In a project with no `topology.ts` holding `CHARTS` and module `shop` (`deps: ['@acme/charts']`, no `clientPii`), with `P` = `s.object({ e: s.string().pii('contact') })`: `chart('shop.a', { data: P })` in `modules/shop/Page.tsx` is one E1107 at the call's first character, message `R(contact)`, whose fix adds `'contact'`; so are `c.chart('shop.a', { data: P })` (`import * as c from '@acme/charts'`) and `wrap('shop.a', P)`; none is in `modules/shop/load.server.ts`, with `clientPii: ['contact']`, or for `chart('shop.a', { data: s.string() })`; the only E1107 under `node_modules/@acme/charts/` is at the first argument of `leaky`'s `store` call, message `U(local)`."
// Spec: k.leave, clause "In that project, in `modules/shop/Page.tsx` with `const make = () => s.string()`: `chart('shop.a', { data: make() })` is one E1107 at the call, message `U(make())`, no fix; `chart('shop.a', { data: s.string(), start: make() })`, `chart('shop.a')` and `leaky('shop.a')` are none; `store(s.object({ k: s.enum([a, b]), l: s.literal(a) }), {}, { id: 'shop.k' })` (`a`, `b` parameters of the enclosing function) is none."
// Spec: k.leave, clause "With `CHARTS` also exporting `secret` (`src/index.ts`, `public.exports`), a copy of `chart` whose `s.object` also holds `ssn: s.string().pii('ssn')`: `secret('shop.a', { data: s.string() })` in `modules/shop/Page.tsx` is one E1107 at the call, message `R(ssn)`, fix adds `'ssn'`; none with `clientPii: ['ssn']`."
// Spec: k.leave, clause "In that project's `modules/shop/Page.tsx` with `const apply = (f: unknown) => f`: `const m = chart`, `apply(chart, P)` and `[c.chart]` are one E1107 each at the name, `store maker <name> …` with `<name>` `chart`, `chart` and `c.chart`, no fix; `ch('shop.a', { data: P })` (`import { chart as ch } from '@acme/charts'`) is one E1107 at the call, message `R(contact)`."
// Spec: k.leave, clause "There, `chart(...pre, { data: P })` (`const pre: [string] = ['shop.a']`) is one E1107 at the call, message `U(...pre)`, no fix."
// Seed 1337
// ASSUMPTIONS (spec silent): "at the name" for a namespace member (`c.chart`) is asserted as a column inside the written name's span; a fix is asserted as a patch that, applied to the project, clears the E1107 at that call; the library's `leaky` store call is located at its first argument by line and column.
// ASSUMPTION: `modules/shop/Page.tsx` and `load.server.ts` are plain files with no default component; only E1107 is read.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Files, SEED } from "./module-support.ts";

const ROOT = "node_modules/@acme/charts";
const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;
const CHART_SRC = `import { s } from '@keel/schema'
import { store } from '@keel/store'
export function chart(id: string, spec: { data: unknown; states: string[] }) {
  const [first, ...rest] = spec.states
  return store(s.object({ state: s.enum([first, ...rest]), data: spec.data }), {}, { id })
}
export const wrap = (id: string, data: unknown) => chart(id, { data, states: ['a'] })
export function leaky(id: string) {
  const local = make()
  return store(s.object({ data: local }), {}, { id })
}
function make() { return s.string() }
export function secret(id: string, spec: { data: unknown; states: string[] }) {
  const [first, ...rest] = spec.states
  return store(s.object({ state: s.enum([first, ...rest]), data: spec.data, ssn: s.string().pii('ssn') }), {}, { id })
}
`;

function charts(withSecret: boolean): Files {
  const names = withSecret ? "'chart', 'wrap', 'leaky', 'secret'" : "'chart', 'wrap', 'leaky'";
  const reexport = withSecret ? "chart, wrap, leaky, secret" : "chart, wrap, leaky";
  return [
    {
      path: `${ROOT}/package.json`,
      source: JSON.stringify({
        name: "@acme/charts",
        version: "1.0.0",
        type: "module",
        keel: "library",
        exports: { ".": "./src/index.ts" },
      }),
    },
    {
      path: `${ROOT}/module.ts`,
      source: `import { module } from '@keel/compiler'\nexport default module({ id: 'charts', deps: [], capabilities: [], public: { exports: [${names}] } })\n`,
    },
    { path: `${ROOT}/src/index.ts`, source: `export { ${reexport} } from './chart.ts'\n` },
    {
      path: `${ROOT}/src/chart.ts`,
      source: withSecret ? CHART_SRC : (CHART_SRC.split("export function secret")[0] ?? ""),
    },
    { path: `${ROOT}/.keel/ledger.json`, source: LEDGER },
  ];
}

const manifest = (clientPii: string[] | undefined): { path: string; source: string } => ({
  path: "modules/shop/module.ts",
  source: `import { module } from '@keel/compiler'\nexport default module({ id: 'shop', deps: ['@acme/charts'], capabilities: [], public: { exports: [] }${
    clientPii ? `, clientPii: [${clientPii.map((c) => `'${c}'`).join(", ")}]` : ""
  } })\n`,
});

const HEAD = `import { chart, wrap, leaky } from '@acme/charts'
import * as c from '@acme/charts'
import { s } from '@keel/schema'
const P = s.object({ e: s.string().pii('contact') })
const make = () => s.string()
`;
const HEAD_LINES = HEAD.split("\n").length - 1;

/** The project: `shop` (no topology.ts, so every file but a server-only one is client code) and the library. */
function project(
  page: string,
  opts: { clientPii?: string[]; secret?: boolean; head?: string; file?: string } = {},
): Files {
  return [
    manifest(opts.clientPii),
    { path: opts.file ?? "modules/shop/Page.tsx", source: `${opts.head ?? HEAD}${page}\n` },
    ...charts(opts.secret ?? false),
  ];
}
const e1107 = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E1107");
const inPage = (files: Files) => e1107(files).filter((d) => d.path === "modules/shop/Page.tsx");
const R = (cls: string) => `store state reaching #k-state holds .pii('${cls}'), not in clientPii`;
const U = (part: string) => `store state not readable at ${part}; cannot show its .pii() classes`;
const NAMED = (name: string) => `store maker ${name} used other than as a call; check cannot follow it`;
/** 1-based column of `needle` on the page's first body line. */
const col = (line: string, needle: string) => line.indexOf(needle) + 1;

function applyFix(files: Files, fix: string): Files {
  const dir = mkdtempSync(join(tmpdir(), "keel-fix-"));
  try {
    for (const f of files) {
      mkdirSync(dirname(join(dir, f.path)), { recursive: true });
      writeFileSync(join(dir, f.path), f.source);
    }
    writeFileSync(join(dir, "fix.patch"), `${fix}\n`);
    execFileSync("git", ["apply", "--unsafe-paths", "--directory=.", "fix.patch"], { cwd: dir, stdio: "pipe" });
    return files.map((f) => ({ path: f.path, source: readFileSync(join(dir, f.path), "utf8") }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const CLASSES = fc.constantFrom("contact", "ssn", "phone");
const headFor = (cls: string) => HEAD.replace("pii('contact')", `pii('${cls}')`);

describe("k.leave Conformance #15: a library's store maker, judged at its callers", () => {
  test("`chart('shop.a', { data: P })` in `modules/shop/Page.tsx` is one E1107 at the call's first character, message `R(contact)`, whose fix adds `'contact'`", () => {
    fc.assert(
      fc.property(CLASSES, (cls) => {
        const line = "export const x = chart('shop.a', { data: P })";
        const files = project(line, { head: headFor(cls) });
        const d = inPage(files);
        expect(d).toHaveLength(1);
        expect(d[0]?.line).toBe(HEAD_LINES + 1);
        expect(d[0]?.col).toBe(col(line, "chart("));
        expect(d[0]?.message).toBe(R(cls));
        const fix = d[0]?.fix;
        expect(fix).toBeDefined();
        expect(inPage(applyFix(files, fix ?? ""))).toEqual([]);
      }),
      { seed: SEED, numRuns: 6 },
    );
  });

  test("`c.chart('shop.a', { data: P })` (`import * as c from '@acme/charts'`) is one E1107 at the call, message `R(contact)`, whose fix adds `'contact'`", () => {
    const line = "export const x = c.chart('shop.a', { data: P })";
    const files = project(line);
    const d = inPage(files);
    expect(d).toHaveLength(1);
    expect(d[0]?.col).toBe(col(line, "c.chart("));
    expect(d[0]?.message).toBe(R("contact"));
    expect(inPage(applyFix(files, d[0]?.fix ?? ""))).toEqual([]);
  });

  test("`wrap('shop.a', P)` (a maker calling a maker) is one E1107 at the call, message `R(contact)`, whose fix adds `'contact'`", () => {
    const line = "export const x = wrap('shop.a', P)";
    const files = project(line);
    const d = inPage(files);
    expect(d).toHaveLength(1);
    expect(d[0]?.col).toBe(col(line, "wrap("));
    expect(d[0]?.message).toBe(R("contact"));
    expect(inPage(applyFix(files, d[0]?.fix ?? ""))).toEqual([]);
  });

  test("`chart('shop.a', { data: P })` is no E1107 in `modules/shop/load.server.ts`", () => {
    const files = project("export const x = chart('shop.a', { data: P })", { file: "modules/shop/load.server.ts" });
    expect(e1107(files).filter((d) => d.path === "modules/shop/load.server.ts")).toEqual([]);
  });

  test("`chart('shop.a', { data: P })` is no E1107 with `clientPii: ['contact']`", () => {
    const files = project("export const x = chart('shop.a', { data: P })", { clientPii: ["contact"] });
    expect(inPage(files)).toEqual([]);
  });

  test("`chart('shop.a', { data: s.string() })` is no E1107", () => {
    expect(inPage(project("export const x = chart('shop.a', { data: s.string() })"))).toEqual([]);
  });

  test("the only E1107 under `node_modules/@acme/charts/` is at the first argument of `leaky`'s `store` call, message `U(local)`", () => {
    const d = e1107(project("export const x = chart('shop.a', { data: P })")).filter((x) =>
      x.path.startsWith(`${ROOT}/`),
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe(`${ROOT}/src/chart.ts`);
    const lines = CHART_SRC.split("\n");
    const at = lines.findIndex((l) => l.includes("return store(s.object({ data: local })"));
    expect(d[0]?.line).toBe(at + 1);
    expect(d[0]?.col).toBe(col(lines[at] ?? "", "s.object({ data: local })"));
    expect(d[0]?.message).toBe(U("local"));
  });
});

describe("k.leave Conformance #16: an argument the read cannot take, and what is not read", () => {
  test("`chart('shop.a', { data: make() })` (`const make = () => s.string()`) is one E1107 at the call, message `U(make())`, no fix", () => {
    const line = "export const x = chart('shop.a', { data: make() })";
    const d = inPage(project(line));
    expect(d).toHaveLength(1);
    expect(d[0]?.line).toBe(HEAD_LINES + 1);
    expect(d[0]?.col).toBe(col(line, "chart("));
    expect(d[0]?.message).toBe(U("make()"));
    expect(d[0]?.fix).toBeUndefined();
  });

  test("`chart('shop.a', { data: s.string(), start: make() })` is no E1107 (the field `start` is on no path of the state schema)", () => {
    expect(inPage(project("export const x = chart('shop.a', { data: s.string(), start: make() })"))).toEqual([]);
  });

  test("`chart('shop.a')` is no E1107 (a missing argument reads nothing)", () => {
    expect(inPage(project("export const x = chart('shop.a')"))).toEqual([]);
  });

  test("`leaky('shop.a')` is no E1107 in the caller", () => {
    expect(inPage(project("export const x = leaky('shop.a')"))).toEqual([]);
  });

  test("`store(s.object({ k: s.enum([a, b]), l: s.literal(a) }), {}, { id: 'shop.k' })` (`a`, `b` parameters of the enclosing function) is no E1107", () => {
    const head = `import { s } from '@keel/schema'\nimport { store } from '@keel/store'\n`;
    const page =
      "export function f(a: string, b: string) { return store(s.object({ k: s.enum([a, b]), l: s.literal(a) }), {}, { id: 'shop.k' }) }";
    expect(inPage(project(page, { head }))).toEqual([]);
  });

  test("a part of the same state schema outside `s.enum` and `s.literal` stays read: `z: make()` beside them is one E1107 `U(make())`", () => {
    const head = `import { s } from '@keel/schema'\nimport { store } from '@keel/store'\nconst make = () => s.string()\n`;
    const page =
      "export function f(a: string, b: string) { return store(s.object({ k: s.enum([a, b]), z: make() }), {}, { id: 'shop.k' }) }";
    const d = inPage(project(page, { head }));
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe(U("make()"));
  });
});

describe("k.leave Conformance #17: a maker's own classes", () => {
  test("`secret('shop.a', { data: s.string() })` is one E1107 at the call, message `R(ssn)`, fix adds `'ssn'`", () => {
    const line = "export const x = secret('shop.a', { data: s.string() })";
    const head = HEAD.replace("{ chart, wrap, leaky }", "{ chart, wrap, leaky, secret }");
    const files = project(line, { secret: true, head });
    const d = inPage(files);
    expect(d).toHaveLength(1);
    expect(d[0]?.col).toBe(col(line, "secret("));
    expect(d[0]?.message).toBe(R("ssn"));
    expect(d[0]?.fix).toBeDefined();
    expect(inPage(applyFix(files, d[0]?.fix ?? ""))).toEqual([]);
  });

  test("`secret('shop.a', { data: s.string() })` is no E1107 with `clientPii: ['ssn']`", () => {
    const head = HEAD.replace("{ chart, wrap, leaky }", "{ chart, wrap, leaky, secret }");
    expect(
      inPage(
        project("export const x = secret('shop.a', { data: s.string() })", { secret: true, head, clientPii: ["ssn"] }),
      ),
    ).toEqual([]);
  });
});

describe("k.leave Conformance #18: a maker used other than as a call", () => {
  const within = (d: { col: number } | undefined, start: number, name: string) => {
    expect(d?.col).toBeGreaterThanOrEqual(start);
    expect(d?.col).toBeLessThanOrEqual(start + name.length);
  };

  test("`const m = chart` is one E1107 at the name, `store maker chart used other than as a call; check cannot follow it`, no fix", () => {
    const line = "export const m = chart";
    const d = inPage(project(line));
    expect(d).toHaveLength(1);
    expect(d[0]?.line).toBe(HEAD_LINES + 1);
    within(d[0], col(line, "chart"), "chart");
    expect(d[0]?.message).toBe(NAMED("chart"));
    expect(d[0]?.fix).toBeUndefined();
  });

  test("`apply(chart, P)` (`const apply = (f: unknown) => f`) is one E1107 at the name `chart`, no fix", () => {
    const line = "export const x = apply(chart, P)";
    const d = inPage(project(`const apply = (f: unknown, ...r: unknown[]) => f\n${line}`));
    expect(d).toHaveLength(1);
    expect(d[0]?.line).toBe(HEAD_LINES + 2);
    within(d[0], col(line, "chart"), "chart");
    expect(d[0]?.message).toBe(NAMED("chart"));
    expect(d[0]?.fix).toBeUndefined();
  });

  test("`[c.chart]` is one E1107 at the name, `store maker c.chart used other than as a call; check cannot follow it`, no fix", () => {
    const line = "export const x = [c.chart]";
    const d = inPage(project(line));
    expect(d).toHaveLength(1);
    within(d[0], col(line, "c.chart"), "c.chart");
    expect(d[0]?.message).toBe(NAMED("c.chart"));
    expect(d[0]?.fix).toBeUndefined();
  });

  test("a namespace holding a maker used other than through a non-computed member (`const n = c`, `c['chart']`) is one E1107 at the name each", () => {
    const a = inPage(project("export const n = c"));
    expect(a).toHaveLength(1);
    expect(a[0]?.message).toBe(NAMED("c"));
    const b = inPage(project("export const n = c['chart']"));
    expect(b).toHaveLength(1);
    expect(b[0]?.message).toBe(NAMED("c"));
  });

  test("a maker's name as a callee, in an export specifier or as `export default` is no E1107", () => {
    expect(inPage(project("export { chart }"))).toEqual([]);
    expect(inPage(project("export default chart"))).toEqual([]);
  });

  test("`ch('shop.a', { data: P })` (`import { chart as ch } from '@acme/charts'`) is one E1107 at the call, message `R(contact)`", () => {
    const head = HEAD.replace("import { chart, wrap, leaky }", "import { chart as ch, wrap, leaky }");
    const line = "export const x = ch('shop.a', { data: P })";
    const d = inPage(project(line, { head }));
    expect(d).toHaveLength(1);
    expect(d[0]?.col).toBe(col(line, "ch("));
    expect(d[0]?.message).toBe(R("contact"));
  });
});

describe("k.leave Conformance #19: a spread argument", () => {
  test("`chart(...pre, { data: P })` (`const pre: [string] = ['shop.a']`) is one E1107 at the call, message `U(...pre)`, no fix", () => {
    const line = "export const x = chart(...pre, { data: P })";
    const d = inPage(project(`const pre: [string] = ['shop.a']\n${line}`));
    expect(d).toHaveLength(1);
    expect(d[0]?.line).toBe(HEAD_LINES + 2);
    expect(d[0]?.col).toBe(col(line, "chart("));
    expect(d[0]?.message).toBe(U("...pre"));
    expect(d[0]?.fix).toBeUndefined();
  });
});
