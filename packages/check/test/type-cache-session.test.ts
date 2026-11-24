// k.check-cache In one process: nothing an earlier `check()` call parsed, loaded or registered changes a later call's
// answer. A parsed file is reused only under the same compiler options; a `@keel/std-*` package's formats and rules
// apply only while the project's app manifests reach it.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, expect, it, vi } from "vitest";
import { check, defineRule } from "../src/index.ts";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const bases: string[] = [];
afterAll(() => {
  for (const b of bases) rmSync(b, { recursive: true, force: true });
});

function put(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}
function scratch(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "keel-session-")));
  bases.push(root);
  put(join(root, "package.json"), '{"name":"p","private":true,"type":"module"}\n');
  mkdirSync(join(root, "node_modules"));
  return root;
}
const MODULE = (deps: string[]) => ({
  path: "modules/a/module.ts",
  source: `import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: [${deps.map((d) => `'${d}'`).join(", ")}], capabilities: [], public: { exports: [] } })\n`,
});
const messages = (ds: readonly { code: string; line: number; message: string }[]) =>
  ds.map((d) => `${d.code} ${d.line} ${d.message}`);

it("a parsed .tsx is not reused when the JSX runtime starts resolving: the second call is a fresh one", async () => {
  const root = scratch();
  const folder = join(root, "node_modules/.cache/keel");
  const files = [{ path: "modules/a/a.tsx", source: "export const a = <span foo={1} />\n" }];
  check(files, { root, typeCache: folder });
  put(
    join(root, "node_modules/@keel/runtime-dom/package.json"),
    '{"name":"@keel/runtime-dom","exports":{"./jsx-runtime":{"types":"./jsx-runtime.d.ts"}}}',
  );
  put(
    join(root, "node_modules/@keel/runtime-dom/jsx-runtime.d.ts"),
    "export namespace JSX { interface IntrinsicElements { span: { bar?: 1 } } }\n",
  );
  const second = messages(check(files, { root, typeCache: folder }).diagnostics);
  vi.resetModules();
  const fresh = (await import("../src/index.ts")).check;
  const fromDisk = messages(fresh(files, { root, typeCache: folder }).diagnostics);
  vi.resetModules();
  const cold = messages((await import("../src/index.ts")).check(files, { root }).diagnostics);
  expect(second).toEqual(cold);
  expect(fromDisk).toEqual(cold);
  expect(cold.some((m) => m.includes("TS2875") || m.includes("TS7026"))).toBe(false);
});

it("E1108 judges against the formats of the packages `deps` lists on this call, not all the process imported", () => {
  const root = scratch();
  mkdirSync(join(root, "node_modules/@keel"));
  symlinkSync(join(REPO, "packages/schema"), join(root, "node_modules/@keel/schema"), "dir");
  symlinkSync(join(REPO, "packages/std-temporal"), join(root, "node_modules/@keel/std-temporal"), "dir");
  symlinkSync(join(REPO, "packages/compiler"), join(root, "node_modules/@keel/compiler"), "dir");
  const at = {
    path: "modules/a/At.ts",
    source:
      "import { formatLiteral } from '@keel/schema'\nimport { Instant } from '@keel/std-temporal'\nexport const t = formatLiteral(Instant, '2026-02-28T00:00:00.000Z')\n",
  };
  const e1108 = (deps: string[]) => check([MODULE(deps), at], { root }).diagnostics.filter((d) => d.code === "E1108");
  expect(e1108(["@keel/std-temporal"])).toEqual([]);
  const without = e1108([]);
  expect(without).toHaveLength(1);
  expect(without[0]?.line).toBe(3);
  expect(without[0]?.message).toContain("temporal.Instant");
  expect(e1108(["@keel/std-temporal"])).toEqual([]);
});

it("a rule a @keel/std-* package defined runs only while the project's deps reach that package", async () => {
  const root = scratch();
  const pkg = join(root, "node_modules/@keel/std-fake");
  put(join(pkg, "package.json"), '{"name":"@keel/std-fake","type":"module"}');
  put(
    join(pkg, "rule.mjs"),
    "export const register = (defineRule) => defineRule({ code: 'E2999', message: 'fake', see: 'k.check', explain: 'A test rule.', check: ({ file }) => file.path.endsWith('b.ts') ? [{ path: file.path, line: 1, col: 1 }] : [] })\n",
  );
  const mod: { register: (d: typeof defineRule) => unknown } = await import(join(pkg, "rule.mjs"));
  mod.register(defineRule);
  const b = { path: "modules/a/b.ts", source: "export const b = 1\n" };
  const e2999 = (deps: string[]) =>
    check([MODULE(deps), b], { root, types: false }).diagnostics.filter((d) => d.code === "E2999");
  expect(e2999(["@keel/std-fake"])).toHaveLength(1);
  expect(e2999([])).toEqual([]);
});
