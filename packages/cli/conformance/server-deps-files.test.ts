// Spec: k.server-deps, the third Conformance clause, quoted whole:
// 3. "In a `node` fixture whose server code imports `node_modules/blob/index.js`, which holds `new URL('./blob.bin', import.meta.url)` and `new URL('other.bin', import.meta.url)` beside files `blob.bin` and `other.bin`, `keel build` writes `dist/<name>/blob.bin` and `dist/<name>/other.bin` equal to them; with `other.bin` deleted, `keel build` fails with one E1014 naming `node_modules/blob/index.js` and `other.bin`."
// Files a bundled package reads: "When `server.mjs` bundles a file under a `node_modules` folder that holds `new URL('<f>', import.meta.url)` with `<f>` a string literal `./<file>` or `<file>`, `<file>` holding no `/`, `keel build` copies `<file>` from that file's folder into `dist/<name>/`, beside `server.mjs`, where the bundle reads it."
// Rules: "E1014 `keel build`: a `<file>` that a bundled package file names (Files a bundled package reads) is missing from that file's folder (message names the package file and `<file>`); the build fails and writes no `dist/<name>/`."
// Seed: 1337 (the bytes of the three files come from `fc.sample` at that seed, binary-safe: they start with 0x00, 0xff and 0x80).
// Binary runs: 2 (`keel build` of the whole fixture; `keel build` of it again with `other.bin` deleted and `dist/` removed). Every case but the last reads the first build.
// The fixture imports two packages: `blob` (an unscoped plain package, as the clause names it; one file at its root and one in `lib/`) and the made-up library `@acme/store` (library-support.ts `dataLibrary`, `src/store.bin` read by `src/store.ts`).
// ASSUMPTIONS (spec silent): the server code is a loader of module `a` (`modules/a/data.server.ts` imports `read` from `blob` and `store` from `@acme/store`); "<name>" is the deployable `api`; "at its bound" is read as the E1014 record naming both strings.
// UNTESTABLE for want of a sentence: what the build does with a form it cannot read (a computed name, a template literal with an expression, a `URL` with another base, a `<file>` holding a `/`). The text states what is copied, not that a form
// outside it is refused or left alone, so no case asserts a behaviour for those forms.
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  SEED,
  SLOW,
  STORE,
  STORE_BIN,
  built,
  bytesAt,
  cleanup,
  dataLibrary,
  filesUnder,
  keelRun,
  loaderModule,
  materialize,
  recordsOf,
  serverDepsProject,
  textAt,
  writeBytes,
} from "./library-support.ts";

const CLAUSE_3 =
  "In a `node` fixture whose server code imports `node_modules/blob/index.js`, which holds `new URL('./blob.bin', import.meta.url)` and `new URL('other.bin', import.meta.url)` beside files `blob.bin` and `other.bin`, `keel build` writes `dist/<name>/blob.bin` and `dist/<name>/other.bin` equal to them; with `other.bin` deleted, `keel build` fails with one E1014 naming `node_modules/blob/index.js` and `other.bin`";

const SAMPLED = fc
  .sample(fc.uint8Array({ minLength: 4, maxLength: 48 }), { seed: SEED, numRuns: 3 })
  .map((b, i) => Uint8Array.from([[0x00, 0xff, 0x80][i] ?? 0, ...b]));
const BLOB = SAMPLED[0] ?? Uint8Array.of(0x00, 1);
const OTHER = SAMPLED[1] ?? Uint8Array.of(0xff, 2);
const DEEP = SAMPLED[2] ?? Uint8Array.of(0x80, 3);
const PKG = "node_modules/blob";

const INDEX_JS = `import { readFileSync } from 'node:fs'
import { deep } from './lib/deep.js'
const blob = new URL('./blob.bin', import.meta.url)
const other = new URL('other.bin', import.meta.url)
export const read = () => readFileSync(blob).length + readFileSync(other).length + deep()
`;
const DEEP_JS = `import { readFileSync } from 'node:fs'
const url = new URL('deep.bin', import.meta.url)
export const deep = () => readFileSync(url).length
`;

const DATA = `import { store } from '${STORE}'
import { read } from 'blob'
const accessor = store()
export const data = (ctx: Parameters<typeof accessor>[0]): string => \`\${accessor(ctx).title()}-\${read()}\`
`;

const fixture = () => ({
  ...serverDepsProject({
    deployables: { api: ["a"] },
    modules: [{ id: "a", deps: [STORE], extra: loaderModule("a", DATA) }],
    libraries: [dataLibrary({ bin: true })],
    dependencies: { blob: "1.0.0" },
  }),
  [`${PKG}/package.json`]: JSON.stringify({
    name: "blob",
    version: "1.0.0",
    type: "module",
    exports: "./index.js",
    types: "./index.d.ts",
  }),
  [`${PKG}/index.js`]: INDEX_JS,
  [`${PKG}/index.d.ts`]: "export declare function read(): number\n",
  [`${PKG}/lib/deep.js`]: DEEP_JS,
});

let dir = "";
let first: ReturnType<typeof built> = { status: null, out: "" };
beforeAll(() => {
  dir = materialize(fixture());
  writeBytes(dir, { [`${PKG}/blob.bin`]: BLOB, [`${PKG}/other.bin`]: OTHER, [`${PKG}/lib/deep.bin`]: DEEP });
  first = built(dir);
}, SLOW);
afterAll(() => cleanup(dir));

const same = (a: Uint8Array | undefined, b: Uint8Array | undefined): boolean =>
  a !== undefined && b !== undefined && Buffer.from(a).equals(Buffer.from(b));

describe(`k.server-deps 3: ${CLAUSE_3}`, () => {
  test("`keel build` of the fixture exits 0", () => {
    expect(first.status, first.out).toBe(0);
  });

  test("`keel build` writes `dist/<name>/blob.bin` equal to the file beside `node_modules/blob/index.js`", () => {
    expect(same(bytesAt(dir, "dist/api/blob.bin"), BLOB)).toBe(true);
  });

  test("`keel build` writes `dist/<name>/other.bin` equal to the file beside `node_modules/blob/index.js`, named by `new URL('other.bin', import.meta.url)` with no `./`", () => {
    expect(same(bytesAt(dir, "dist/api/other.bin"), OTHER)).toBe(true);
  });

  test("the files are copied beside `server.mjs`, where the bundle reads them", () => {
    expect(existsSync(join(dir, "dist/api/server.mjs"))).toBe(true);
    for (const f of ["blob.bin", "other.bin"]) expect(existsSync(join(dir, "dist/api", f)), f).toBe(true);
  });

  test("a `<file>` is copied from the folder of the file that names it: `node_modules/blob/lib/deep.js` names `deep.bin`, copied from `lib/`", () => {
    expect(same(bytesAt(dir, "dist/api/deep.bin"), DEEP)).toBe(true);
  });

  test("a library's file under `node_modules` is a bundled package file: `@acme/store`'s `src/store.ts` names `./store.bin`, copied beside `server.mjs`", () => {
    expect(textAt(dir, "dist/api/store.bin")).toBe(STORE_BIN);
  });

  test("a copied file is copied byte for byte (property over the three files' bytes)", () => {
    fc.assert(
      fc.property(fc.constantFrom("blob.bin", "other.bin", "deep.bin"), (f) => {
        const want = f === "blob.bin" ? BLOB : f === "other.bin" ? OTHER : DEEP;
        expect(same(bytesAt(dir, `dist/api/${f}`), want)).toBe(true);
      }),
      { seed: SEED, numRuns: 6 },
    );
  });

  test(
    "with `other.bin` deleted, `keel build` fails with one E1014 naming `node_modules/blob/index.js` and `other.bin`, and writes no `dist/<name>/`",
    () => {
      rmSync(join(dir, PKG, "other.bin"));
      rmSync(join(dir, "dist"), { recursive: true, force: true });
      const r = keelRun(dir, ["build"]);
      expect(r.status, r.out).toBe(1);
      const hits = recordsOf(r.out, "E1014");
      expect(recordsOf(r.out, "E1014")).toHaveLength(1);
      expect(hits[0]).toContain("node_modules/blob/index.js");
      expect(hits[0]).toContain("other.bin");
      expect(filesUnder(join(dir, "dist")).filter((f) => f.includes("/dist/api/"))).toEqual([]);
      expect(existsSync(join(dir, "dist/api"))).toBe(false);
    },
    SLOW,
  );
});
