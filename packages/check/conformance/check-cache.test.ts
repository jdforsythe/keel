// Spec: k.check-cache, clause "`check()` called twice in one process with the same files and `{ root }`, with `node_modules/foo/index.d.ts` rewritten between the calls to `export declare const n: string` with its old modification time, reports no E1751 on the first call and one on the second."
// Spec: k.check-cache, clause "After 5 `check()` calls with one empty `typeCache` folder into which a file `t.json.999999.tmp` was placed first, each call over a different text of `modules/a/a.ts`, the folder holds 4 entry files and no `t.json.999999.tmp`."
// Spec: k.check-cache, clause "In one process, `check()` with `{ root, typeCache }` of a project whose `modules/a/a.tsx` is `export const a = <span foo={1} />` and whose `node_modules` holds no `@keel/runtime-dom`; then `node_modules/@keel/runtime-dom/package.json` `{\"name\":\"@keel/runtime-dom\",\"exports\":{\"./jsx-runtime\":{\"types\":\"./jsx-runtime.d.ts\"}}}` and `node_modules/@keel/runtime-dom/jsx-runtime.d.ts` `export namespace JSX { interface IntrinsicElements { span: { bar?: 1 } } }` are written; a second `check()` in that process, and a following `keel check` with the folder the second call left, each report the diagnostics a fresh `keel check` with `node_modules/.cache/keel` deleted reports, none of them a message starting `TS2875` or `TS7026`."
// #10 asserts both halves here: the in-process calls, and the spawned `keel check` (as check-json-byte-identical-binary.test.ts spawns the cli). #11 is in packages/std-temporal/conformance/check-deps-dropped.test.ts.
// Spec: k.check-cache, sentence "The in-process memo of `check()` (an editor session, `keel mcp`) is held to the same probes." (the cases beyond the mtime one: a dependency's `package.json`, a shadowing file, a deleted file)
// Seed 1337 (the 33-call case draws its texts from a fixed range). Scratch projects under a realpath'd temp folder; time is set only with `utimesSync` to a fixed past second.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "@keel/check";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";

const SEED = 1337;
const BIN = join(dirname(fileURLToPath(import.meta.url)), "../../cli/src/bin.ts");
/** Each test declares its bound (docs/TESTING.md Wall-clock bounds). */
const SLOW = 120_000;
const OLD = 1_700_000_000;

const bases: string[] = [];
afterAll(() => {
  for (const b of bases) rmSync(b, { recursive: true, force: true });
});

function put(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  utimesSync(path, OLD, OLD);
}
const A = (spec = "foo", tail = "") => `import { n } from '${spec}'\n\nexport const a: number = n${tail}\n`;
const DTS = (type: string) => `export declare const n: ${type}\n`;

function project(spec = "foo", sub = false): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "keel-check-cache-")));
  bases.push(root);
  put(join(root, "package.json"), '{"name":"p","private":true,"type":"module"}\n');
  put(join(root, "node_modules/foo/package.json"), '{"name":"foo","types":"index.d.ts"}\n');
  put(join(root, "node_modules/foo/index.d.ts"), DTS("number"));
  if (sub) put(join(root, "node_modules/foo/sub.d.ts"), DTS("number"));
  put(join(root, "modules/a/a.ts"), A(spec));
  return root;
}
const e1751 = (root: string, source = A(), opts: { typeCache?: string } = {}) =>
  check([{ path: "modules/a/a.ts", source }], { root, ...opts }).diagnostics.filter((d) => d.code === "E1751");

describe("k.check-cache #6: the in-process memo", () => {
  test(
    "`check()` called twice in one process with the same files and `{ root }`, with `node_modules/foo/index.d.ts` rewritten between the calls to `export declare const n: string` with its old modification time, reports no E1751 on the first call and one on the second",
    () => {
      const root = project();
      expect(e1751(root)).toEqual([]);
      put(join(root, "node_modules/foo/index.d.ts"), DTS("string"));
      const second = e1751(root);
      expect(second).toHaveLength(1);
      expect(second[0]?.path).toBe("modules/a/a.ts");
      expect(second[0]?.line).toBe(3);
    },
    SLOW,
  );

  test(
    "a dependency's `package.json` changed between two calls (`types` to a new file) is seen by the second call",
    () => {
      const root = project();
      expect(e1751(root)).toEqual([]);
      put(join(root, "node_modules/foo/other.d.ts"), DTS("string"));
      put(join(root, "node_modules/foo/package.json"), '{"name":"foo","types":"other.d.ts"}\n');
      expect(e1751(root)).toHaveLength(1);
    },
    SLOW,
  );

  test(
    "a new file that shadows a resolution (`foo/sub.ts` beside `sub.d.ts`) between two calls is seen by the second call",
    () => {
      const root = project("foo/sub", true);
      expect(e1751(root, A("foo/sub"))).toEqual([]);
      put(join(root, "node_modules/foo/sub.ts"), "export const n: string = 's'\n");
      expect(e1751(root, A("foo/sub"))).toHaveLength(1);
    },
    SLOW,
  );

  test(
    "a deleted file between two calls: the second call reports what a call in a fresh project with the file absent reports",
    () => {
      const root = project();
      expect(e1751(root)).toEqual([]);
      rmSync(join(root, "node_modules/foo/index.d.ts"));
      const other = project();
      rmSync(join(other, "node_modules/foo/index.d.ts"));
      expect(e1751(root).map((d) => [d.code, d.line, d.message])).toEqual(
        e1751(other).map((d) => [d.code, d.line, d.message]),
      );
    },
    SLOW,
  );
});

describe("k.check-cache #7: a folder keeps 4 entries and removes stray temporary files", () => {
  test(
    "after 5 `check()` calls with one empty `typeCache` folder into which a file `t.json.999999.tmp` was placed first, each call over a different text of `modules/a/a.ts`, the folder holds 4 entry files and no `t.json.999999.tmp`",
    () => {
      const root = project();
      const folder = join(root, "cache");
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, "t.json.999999.tmp"), "x");
      fc.assert(
        fc.property(fc.constant(5), (calls) => {
          for (let i = 0; i < calls; i++) e1751(root, A("foo", ` // ${i}`), { typeCache: folder });
          const files = readdirSync(folder);
          expect(files).toHaveLength(4);
          expect(files).not.toContain("t.json.999999.tmp");
        }),
        { seed: SEED, numRuns: 1 },
      );
    },
    SLOW,
  );
});

describe("k.check-cache #10: one process answers as a fresh one", () => {
  test(
    "a `@keel/runtime-dom` that appears between two `check()` calls changes the pass: the second call and a following `keel check` report what a fresh `keel check` reports, none of them TS2875 or TS7026",
    () => {
      const root = realpathSync(mkdtempSync(join(tmpdir(), "keel-check-cache-")));
      bases.push(root);
      put(join(root, "package.json"), '{"name":"p","private":true,"type":"module"}\n');
      mkdirSync(join(root, "node_modules"), { recursive: true });
      const source = "export const a = <span foo={1} />\n";
      put(join(root, "modules/a/a.tsx"), source);
      const folder = join(root, "node_modules/.cache/keel");
      const call = () => check([{ path: "modules/a/a.tsx", source }], { root, typeCache: folder }).diagnostics;
      call();
      const rd = join(root, "node_modules/@keel/runtime-dom");
      put(
        join(rd, "package.json"),
        '{"name":"@keel/runtime-dom","exports":{"./jsx-runtime":{"types":"./jsx-runtime.d.ts"}}}\n',
      );
      put(join(rd, "jsx-runtime.d.ts"), "export namespace JSX { interface IntrinsicElements { span: { bar?: 1 } } }\n");
      const second = call();
      const follow = spawn(root);
      rmSync(folder, { recursive: true, force: true });
      const fresh = spawn(root);
      const shape = (ds: readonly { code: string; path: string; line: number; col: number; message: string }[]) =>
        ds.filter((d) => d.path === "modules/a/a.tsx").map((d) => [d.code, d.path, d.line, d.col, d.message]);
      expect(shape(second)).toEqual(shape(fresh));
      expect(shape(follow)).toEqual(shape(fresh));
      for (const d of [...second, ...follow, ...fresh]) expect(d.message).not.toMatch(/^TS(2875|7026)/);
    },
    SLOW,
  );
});

/** `keel check --format=json` in `root` (the real binary): its diagnostic records. */
function spawn(root: string) {
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST") continue;
    env[k] = v;
  }
  const r = spawnSync(process.execPath, [BIN, "check", "--format=json"], { cwd: root, encoding: "utf8", env });
  const out: { code: string; path: string; line: number; col: number; message: string }[] = [];
  for (const line of r.stdout.split("\n")) {
    if (line.trim() === "") continue;
    const v: unknown = JSON.parse(line);
    if (
      typeof v === "object" &&
      v !== null &&
      "kind" in v &&
      v.kind === "diag" &&
      "code" in v &&
      typeof v.code === "string" &&
      "path" in v &&
      typeof v.path === "string" &&
      "line" in v &&
      typeof v.line === "number" &&
      "col" in v &&
      typeof v.col === "number" &&
      "message" in v &&
      typeof v.message === "string"
    )
      out.push({ code: v.code, path: v.path, line: v.line, col: v.col, message: v.message });
  }
  return out;
}
