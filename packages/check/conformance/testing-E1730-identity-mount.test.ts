// Spec: k.guards, Conformance "In a project with `identity.ts` beside `topology.ts`, `keel check` reports one E1730 for `renderRoute('a.page', { routes })` in `modules/a/test/page.test.ts`, at the options object, its message `renderRoute names no identity mount; import mount from '../../../identity.ts' and pass it`; applying its fix adds `import mount from '../../../identity.ts';` and `mount` to the options, and the file then has no E1730. It reports none for the same call with `mount` or with `app`, with a spread in the options, in a non-test file, or in a project without `identity.ts`."
// Spec: k.guards, Test files "`keel check` reports E1730 at the options object of a `renderRoute` call from `@keel/testing` (any alias) in a test file of a project with `identity.ts` beside `topology.ts`, when the options are an object literal with no spread, no computed key, and neither `mount` nor `app`: `renderRoute names no identity mount; import mount from '<path>' and pass it`, `<path>` the relative specifier of `identity.ts` from the file. Its fix adds `mount` to the options and, when the file has no default import of `identity.ts`, `import mount from '<path>';` after its last import (`mount: <name>` when it has one under another name); no fix when the file binds `mount` otherwise. Non-literal options are none."
// Spec: k.testing, Rules "E1730 a test's `renderRoute` with neither `mount` nor `app` in a project with `identity.ts` (k.guards Client)"
// Seed 1337 (fc.assert below). Public API only: `check` and `explain` from @keel/check, the fix applied with `git apply` as fix-diffs.test.ts does.
// ASSUMPTIONS: "at the options object" is the line and 1-based column of the object literal's `{`; "after its last import" is the line after the last `import` statement; the fix appends `mount` to the object's keys (any position passes: the property reads the keys, not their order).
// UNTESTABLE here: "`keel check` only, not at run" (RFC 0219 D4) is no sentence of the spec's Conformance; the run-time half is asserted in packages/cli/conformance/test-identity-read.test.ts (a no-mount test file runs and passes).
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { check } from "@keel/check";
import { explain } from "@keel/check/explain";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Files, SEED, approxTokens } from "./support.ts";

const NO_TYPES = { types: false } as const;
const f = (path: string, source: string): Files[number] => ({ path, source });
const manifest = (id: string): Files[number] =>
  f(
    `modules/${id}/module.ts`,
    `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`,
  );
const IDENTITY = [
  f("identity.ts", "import { identityMount } from '@keel/router'\nexport default identityMount('/api/auth')\n"),
  f(
    "identity.server.ts",
    "import { identity } from '@keel/server'\nimport mount from './identity.ts'\nexport default identity({ identify: async () => '', handle: { path: mount.path, fn: () => new Response('') } })\n",
  ),
];
const TOPOLOGY = f(
  "topology.ts",
  "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['a'], adapter: 'client', servedBy: 'api' }, api: { modules: ['b'], adapter: 'node' } })\n",
);
const TEST_PATH = "modules/a/test/page.test.ts";
const HEAD = "import { renderRoute } from '@keel/testing'\nimport { test } from 'vitest'\ndeclare const routes: never\n";
const testFile = (call: string, head = HEAD): string =>
  `${head}test('x', async () => { await ${call} })\n`;
const project = (source: string, path = TEST_PATH, withIdentity = true): Files => [
  TOPOLOGY,
  manifest("a"),
  manifest("b"),
  ...(withIdentity ? IDENTITY : []),
  f(path, source),
];
const e1730 = (files: Files) => check(files, NO_TYPES).diagnostics.filter((d) => d.code === "E1730");

function applyFix(files: Files, fix: string): Files {
  const dir = mkdtempSync(join(tmpdir(), "keel-e1730-"));
  try {
    for (const x of files) {
      mkdirSync(dirname(join(dir, x.path)), { recursive: true });
      writeFileSync(join(dir, x.path), x.source);
    }
    writeFileSync(join(dir, "fix.patch"), `${fix}\n`);
    execFileSync("git", ["apply", "--unsafe-paths", "--directory=.", "fix.patch"], { cwd: dir, stdio: "pipe" });
    return files.map((x) => ({ path: x.path, source: readFileSync(join(dir, x.path), "utf8") }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const sourceOf = (files: Files, path: string): string => files.find((x) => x.path === path)?.source ?? "";

test("in a project with identity.ts beside topology.ts, keel check reports one E1730 for renderRoute('a.page', { routes }) in modules/a/test/page.test.ts, at the options object, its message renderRoute names no identity mount; import mount from '../../../identity.ts' and pass it", () => {
  const src = testFile("renderRoute('a.page', { routes })");
  const found = e1730(project(src));
  expect(found).toHaveLength(1);
  const [d] = found;
  expect(d?.path).toBe(TEST_PATH);
  expect(d?.message).toBe("renderRoute names no identity mount; import mount from '../../../identity.ts' and pass it");
  const lines = src.split("\n");
  const line = lines.findIndex((l) => l.includes("{ routes }")) + 1;
  expect(d?.line).toBe(line);
  expect(d?.col).toBe((lines[line - 1] ?? "").indexOf("{ routes }") + 1);
  expect(d?.code.startsWith("E")).toBe(true);
});

test("applying the E1730 fix adds import mount from '../../../identity.ts'; after the last import and mount to the options, and the file then has no E1730", () => {
  const files = project(testFile("renderRoute('a.page', { routes })"));
  const fix = e1730(files)[0]?.fix;
  expect(typeof fix).toBe("string");
  if (fix === undefined) return;
  const patched = applyFix(files, fix);
  const text = sourceOf(patched, TEST_PATH);
  const lines = text.split("\n");
  const lastImport = lines.map((l) => l.startsWith("import ")).lastIndexOf(true);
  expect(lines[lastImport]).toBe("import mount from '../../../identity.ts';");
  expect(lines.filter((l) => l.includes("identity.ts"))).toHaveLength(1);
  expect(text).toMatch(/renderRoute\('a\.page', \{[^}]*\bmount\b[^}]*\}\)/);
  expect(text).toMatch(/\{[^}]*\broutes\b[^}]*\}/);
  expect(e1730(patched)).toEqual([]);
});

test("E1730 reports none for the same call with mount or with app", () => {
  const withMount = testFile("renderRoute('a.page', { routes, mount })", `${HEAD}declare const mount: never\n`);
  const withApp = testFile("renderRoute('a.page', { routes, app })", `${HEAD}declare const app: never\n`);
  expect(e1730(project(withMount))).toEqual([]);
  expect(e1730(project(withApp))).toEqual([]);
});

test("E1730 reports none for the same call with a spread in the options", () => {
  const src = testFile("renderRoute('a.page', { routes, ...rest })", `${HEAD}declare const rest: object\n`);
  expect(e1730(project(src))).toEqual([]);
});

test("E1730 reports none for the same call in a non-test file", () => {
  const src = testFile("renderRoute('a.page', { routes })");
  expect(e1730(project(src, "modules/a/helper.ts"))).toEqual([]);
});

test("E1730 reports none for the same call in a project without identity.ts", () => {
  const src = testFile("renderRoute('a.page', { routes })");
  expect(e1730(project(src, TEST_PATH, false))).toEqual([]);
});

test("E1730 reports none for options that are not an object literal, and none for a computed key", () => {
  const variable = testFile("renderRoute('a.page', opts)", `${HEAD}declare const opts: object\n`);
  const computed = testFile("renderRoute('a.page', { routes, [key]: 1 })", `${HEAD}declare const key: string\n`);
  expect(e1730(project(variable))).toEqual([]);
  expect(e1730(project(computed))).toEqual([]);
});

test("E1730 is reported for a renderRoute under any alias of the @keel/testing import", () => {
  const src = testFile("rr('a.page', { routes })", "import { renderRoute as rr } from '@keel/testing'\nimport { test } from 'vitest'\ndeclare const routes: never\n");
  expect(e1730(project(src))).toHaveLength(1);
});

test("E1730 is not reported for a renderRoute that is not from @keel/testing", () => {
  const src = "import { test } from 'vitest'\ndeclare function renderRoute(id: string, o: object): Promise<void>\ndeclare const routes: never\ntest('x', async () => { await renderRoute('a.page', { routes }) })\n";
  expect(e1730(project(src))).toEqual([]);
});

test("for generated option keys with neither mount nor app, E1730 is one at the object; with mount or app added or a spread added, none", () => {
  const KEYS = ["routes", "params", "search", "ctx", "caller", "user", "state", "shell"] as const;
  fc.assert(
    fc.property(
      fc.subarray([...KEYS], { minLength: 1 }),
      fc.constantFrom("mount", "app", "...rest"),
      fc.constantFrom("a.page", "a.edit", "b.show"),
      (keys, extra, id) => {
        const decls = `${HEAD}declare const params: never\ndeclare const search: never\ndeclare const ctx: never\ndeclare const caller: never\ndeclare const user: never\ndeclare const state: never\ndeclare const shell: never\ndeclare const mount: never\ndeclare const app: never\ndeclare const rest: object\n`;
        const bare = testFile(`renderRoute('${id}', { ${keys.join(", ")} })`, decls);
        const more = testFile(`renderRoute('${id}', { ${[...keys, extra].join(", ")} })`, decls);
        expect(e1730(project(bare))).toHaveLength(1);
        expect(e1730(project(more))).toEqual([]);
      },
    ),
    { seed: SEED, numRuns: 25 },
  );
});

test("the E1730 fix of a file holding a default import of identity.ts under another name writes mount: <name> and adds no import", () => {
  const head = `${HEAD}import who from '../../../identity.ts'\n`;
  const files = project(testFile("renderRoute('a.page', { routes })", head));
  const d = e1730(files)[0];
  expect(typeof d?.fix).toBe("string");
  if (d?.fix === undefined) return;
  const patched = applyFix(files, d.fix);
  const text = sourceOf(patched, TEST_PATH);
  expect(text).toMatch(/\{[^}]*\bmount: who\b[^}]*\}/);
  expect(text.match(/identity\.ts/g)).toHaveLength(1);
  expect(e1730(patched)).toEqual([]);
});

test("E1730 carries no fix when the file binds mount otherwise", () => {
  const head = `${HEAD}const mount = 1\n`;
  const found = e1730(project(testFile("renderRoute('a.page', { routes })", head)));
  expect(found).toHaveLength(1);
  expect(found[0]?.fix).toBeUndefined();
});

test("the message names the relative specifier of identity.ts from the file, for any depth of the test file", () => {
  fc.assert(
    fc.property(fc.array(fc.constantFrom("test", "unit", "deep"), { minLength: 0, maxLength: 3 }), (dirs) => {
      const path = ["modules", "a", ...dirs, "x.test.ts"].join("/");
      const up = "../".repeat(dirs.length + 2);
      const [d] = e1730(project(testFile("renderRoute('a.page', { routes })"), path));
      expect(d?.message).toBe(`renderRoute names no identity mount; import mount from '${up}identity.ts' and pass it`);
    }),
    { seed: SEED, numRuns: 12 },
  );
});

test("explain E1730 has an entry naming the code and mount, at most 120 tokens", () => {
  const text = explain("E1730");
  expect(text).toContain("E1730");
  expect(text).toContain("mount");
  expect(approxTokens(text)).toBeLessThanOrEqual(120);
  expect(text.replaceAll("E1730", "#")).not.toBe(explain("E9998").replaceAll("E9998", "#"));
});
