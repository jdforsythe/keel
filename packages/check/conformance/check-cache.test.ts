// Spec: k.check-cache, clause "`check()` called twice in one process with the same files and `{ root }`, with `node_modules/foo/index.d.ts` rewritten between the calls to `export declare const n: string` with its old modification time, reports no E1751 on the first call and one on the second."
// Spec: k.check-cache, clause "After 33 `check()` calls with one `typeCache` folder, each over a different text of `modules/a/a.ts`, the folder holds 32 entry files."
// Spec: k.check-cache, sentence "The in-process memo of `check()` (an editor session, `keel mcp`) is held to the same probes." (the cases beyond the mtime one: a dependency's `package.json`, a shadowing file, a deleted file)
// Seed 1337 (the 33-call case draws its texts from a fixed range). Scratch projects under a realpath'd temp folder; time is set only with `utimesSync` to a fixed past second.
import { mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { check } from "@keel/check";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";

const SEED = 1337;
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

describe("k.check-cache #7: a folder keeps 32 entries", () => {
  test(
    "after 33 `check()` calls with one `typeCache` folder, each over a different text of `modules/a/a.ts`, the folder holds 32 entry files",
    () => {
      const root = project();
      const folder = join(root, "cache");
      fc.assert(
        fc.property(fc.constant(33), (calls) => {
          rmSync(folder, { recursive: true, force: true });
          for (let i = 0; i < calls; i++) e1751(root, A("foo", ` // ${i}`), { typeCache: folder });
          expect(readdirSync(folder)).toHaveLength(32);
        }),
        { seed: SEED, numRuns: 1 },
      );
    },
    SLOW,
  );
});
