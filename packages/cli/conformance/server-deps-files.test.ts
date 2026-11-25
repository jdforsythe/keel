// Spec: k.server-deps, Conformance clauses 3, 6 and 9, each quoted whole:
// 3. "In a `node` fixture whose server code imports `node_modules/blob/index.js`, which holds `new URL('./blob.bin', import.meta.url)` and `new URL('other.bin', import.meta.url)` beside files `blob.bin` and `other.bin`, `keel build` writes `dist/<name>/blob.bin` and `dist/<name>/other.bin` equal to them; with `other.bin` deleted, `keel build` fails with one E1014 naming `node_modules/blob/index.js` and `other.bin`."
// 6. "In that `node` fixture, `node_modules/blob/lib/deep.js` holding `new URL('deep.bin', import.meta.url)` makes `keel build` write `dist/<name>/deep.bin` from `lib/`, and `new URL('./wasm/x.bin', import.meta.url)` in `index.js` writes `dist/<name>/wasm/x.bin`; `new URL('https://example.com/x', import.meta.url)` and `new URL('.', import.meta.url)` copy nothing and fail nothing; `new URL('../up.bin', import.meta.url)`, `new URL(name, import.meta.url)` and ``new URL(`./${name}.bin`, import.meta.url)`` each make `keel build` fail with one E1014 naming `node_modules/blob/index.js`, and no `dist/<name>/`."
// 9. "In a `node` fixture whose `modules/a` lists `@acme/store`, a library linked through a workspace (its real folder outside the project) whose `src/store.ts` holds `new URL('./store.bin', import.meta.url)`, `keel build` writes `dist/<name>/store.bin`; with `store.bin` deleted it fails with one E1014 naming `node_modules/@acme/store/src/store.ts`; two libraries each shipping a `data.bin` of other bytes fail it with one E1014."
// Files a bundled package reads: "A bundled package file is a file a `node` deployable's `server.mjs` bundles that lies under a `node_modules` folder or is a library's (k.library), wherever the library's real folder is: installed, linked through a workspace, or inside the project. A library's file is named at `node_modules/<name>/<f>`. Its `new URL(<a>, import.meta.url)` calls are read; a `new URL` with any other base is not. The bundle resolves `<a>` against `server.mjs`, so:"
// - `<a>` a string literal, or a template literal without an expression, naming a path inside that file's folder (`./x.bin`, `x.bin`, `wasm/x.bin`): `keel build` copies the file or folder at that path into `dist/<name>/` at the same path, beside `server.mjs`.
// - `<a>` naming an absolute URL (it begins `<scheme>:`) or that folder itself (`.`, `./`): left alone.
// - `<a>` naming a path that leaves that folder (`../x.bin`, `/x.bin`), even inside the package, or `<a>` of any other form: E1014, since `dist/<name>/` could not hold the file where the bundle reads it.
// - Two bundled package files naming one path for files of different bytes, in one package or in two (two libraries each shipping `data.bin`): E1014; with equal bytes the path is copied once. A file is never renamed or moved, and the bundle is not rewritten.
// A stated limit: a package whose own layout reads a file above the reading file's folder (`new URL('../x.tar.gz', import.meta.url)`) cannot be served by `keel build`, even though the file is inside the package. All bundled files become `server.mjs`, so the bundle resolves that path against `server.mjs`, above `dist/<name>/`.
// Rules: "A clipped `<name>` (28 units), `<f>` (40), `<other>` (36), `<export>` or `<id>` (20) ends in `...`, by k.check Diagnostics' clip at that width, and every message is within 89. E1167 an `env` entry that is not a string literal matching `[A-Z][A-Z0-9_]*`, or that is a key `DeployEnv` parses (`PORT`, `KEEL_SECRET`, `KEEL_ORIGIN`, `KEEL_DATABASE_URL`, `KEEL_ALLOW_ORIGINS`) or begins with `KEEL_PEER_`, at the entry: its line and the column of its first character, a string literal's opening quote (an `env` that is no array literal: at its value); messages `env entry is not a string literal` (an entry or an `env` that is no string literal), `env name "<name>" does not match [A-Z][A-Z0-9_]*`, and `env name "<name>" is a key DeployEnv reads` (a `DeployEnv` key, or a name in the pattern beginning with `KEEL_PEER_`); no fix · E1014 `keel build`: a bundled package file's `new URL(<a>, import.meta.url)` whose `<a>` is of no form Files a bundled package reads copies or leaves alone, names a missing path, or names a path another bundled package file names for a file of other bytes; located at the package file (a library's at `node_modules/<name>/<f>`, any other by its path from its last `node_modules/` folder); messages `reads <f>, which is missing`, `reads <f>, outside its own folder`, `reads <f>, as <other> reads another file`, `reads new URL(x, import.meta.url) with x no string literal`, `<f>` the first argument as written, a leading `./` kept, `<other>` the other package file as located; the build fails and writes no `dist/<name>/`."
// Seed: 1337 (the bytes of the files come from `fc.sample` at that seed, binary-safe: each starts with 0x00, 0xff or 0x80; the clip properties draw from it too).
// Binary runs: 14 `keel build` (the `blob` fixture: the whole build, `../up.bin`, `new URL(name, ...)`, a template with an expression, a group of three more refusals, `other.bin` deleted, two packages naming `dup.bin` of other bytes; the workspace-linked library: the whole build, `store.bin` deleted;
// the library inside the project: the whole build, `store.bin` deleted; two libraries naming `data.bin` with equal bytes, then with other bytes) and 1 `node dist/api/server.mjs` (the linked library, read through the running server). Every case that reads outputs reads the first build of its project.
// The fixture imports `blob` and `blob2` (unscoped plain packages, as the clause names `blob`) and the made-up libraries `@acme/store`, `@acme/one` and `@acme/two` (library-support.ts `dataLibrary`, written here for the last two): no stdlib package is named.
// ASSUMPTIONS (spec silent): the server code is a loader of module `a`; "<name>" is the deployable `api`; `<f>` is the text of `<a>` as written (`other.bin`, `../up.bin`, `/x.bin`), and for `./store.bin` either that or `store.bin` is accepted; `<other>` in "reads <f>, as <other> reads another file" is the other package file's location
// (`node_modules/<name>/<f>`), the E1014 located at either one of the two; "clipped to 40 / 36 units" is read by k.check's clip rule at that width (a longer value keeps its first 37 / 33 units, one fewer before the first half of a surrogate pair, then `...`).
// UNTESTABLE: the stated limit's reason ("the bundle resolves that path against `server.mjs`, above `dist/<name>/`"); its effect, E1014 for `../root.bin` though the file is inside the package, is asserted in the group case of clause 6.
// "copy nothing" is asserted as: no entry of the package folder (`package.json`, `index.js`, `lib/`) and no `example.com` appears in `dist/api/`. A literal `new URL(x, <other base>)` is asserted as read-not: the build succeeds though `x` names a file that exists nowhere.
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { send, withServer } from "./boundary-support.ts";
import {
  LEDGER,
  SEED,
  SLOW,
  STORE,
  STORE_BIN,
  type Tree,
  built,
  bytesAt,
  cleanup,
  dataLibrary,
  keelRun,
  linkBeside,
  linkInside,
  loaderModule,
  manifestOf,
  materialize,
  serverDepsProject,
  textAt,
  writeBytes,
} from "./library-support.ts";

const CLAUSE_3 =
  "In a `node` fixture whose server code imports `node_modules/blob/index.js`, which holds `new URL('./blob.bin', import.meta.url)` and `new URL('other.bin', import.meta.url)` beside files `blob.bin` and `other.bin`, `keel build` writes `dist/<name>/blob.bin` and `dist/<name>/other.bin` equal to them; with `other.bin` deleted, `keel build` fails with one E1014 naming `node_modules/blob/index.js` and `other.bin`";
const CLAUSE_6 =
  "In that `node` fixture, `node_modules/blob/lib/deep.js` holding `new URL('deep.bin', import.meta.url)` makes `keel build` write `dist/<name>/deep.bin` from `lib/`, and `new URL('./wasm/x.bin', import.meta.url)` in `index.js` writes `dist/<name>/wasm/x.bin`; `new URL('https://example.com/x', import.meta.url)` and `new URL('.', import.meta.url)` copy nothing and fail nothing; `new URL('../up.bin', import.meta.url)`, `new URL(name, import.meta.url)` and ``new URL(`./${name}.bin`, import.meta.url)`` each make `keel build` fail with one E1014 naming `node_modules/blob/index.js`, and no `dist/<name>/`";
const CLAUSE_9 =
  "In a `node` fixture whose `modules/a` lists `@acme/store`, a library linked through a workspace (its real folder outside the project) whose `src/store.ts` holds `new URL('./store.bin', import.meta.url)`, `keel build` writes `dist/<name>/store.bin`; with `store.bin` deleted it fails with one E1014 naming `node_modules/@acme/store/src/store.ts`; two libraries each shipping a `data.bin` of other bytes fail it with one E1014";

const SAMPLED = fc
  .sample(fc.uint8Array({ minLength: 4, maxLength: 48 }), { seed: SEED, numRuns: 8 })
  .map((b, i) => Uint8Array.from([[0x00, 0xff, 0x80, 0x00, 0xff, 0x80, 0x00, 0xff][i] ?? 0, ...b, i]));
const [BLOB, OTHER, DEEP, WASM, DUP, TPL, ROOT] = SAMPLED;
const bin = (b: Uint8Array | undefined, d: Uint8Array): Uint8Array => b ?? d;
const PKG = "node_modules/blob";
const PKG2 = "node_modules/blob2";

// `SLOT` stands for the extra `new URL` a case adds (default none); every URL is held by the exported function so the bundle keeps it.
const indexJs = (slot: string): string => `import { readFileSync } from 'node:fs'
import { deep } from './lib/deep.js'
const blob = new URL('./blob.bin', import.meta.url)
const other = new URL('other.bin', import.meta.url)
const wasm = new URL('./wasm/x.bin', import.meta.url)
const abs = new URL('https://example.com/x', import.meta.url)
const dot = new URL('.', import.meta.url)
const dotSlash = new URL('./', import.meta.url)
const tpl = new URL(\`./tpl.bin\`, import.meta.url)
const folder = new URL('./folder', import.meta.url)
const dup = new URL('dup.bin', import.meta.url)
const elsewhere = new URL('./no-such-file.bin', 'file:///nowhere/')
export const read = () =>
  readFileSync(blob).length + readFileSync(other).length + readFileSync(wasm).length + readFileSync(tpl).length +
  readFileSync(dup).length + [abs, dot, dotSlash, folder, elsewhere, ${slot}].length + deep()
`;
const deepJs = (slot: string): string => `import { readFileSync } from 'node:fs'
const url = new URL('deep.bin', import.meta.url)
export const deep = () => readFileSync(url).length + [${slot}].length
`;
const blob2Js = `import { readFileSync } from 'node:fs'
export const read2 = () => readFileSync(new URL('dup.bin', import.meta.url)).length
`;
const pkgJson = (name: string): string =>
  JSON.stringify({ name, version: "1.0.0", type: "module", exports: "./index.js", types: "./index.d.ts" });

const DATA = `import { store } from '${STORE}'
import { read } from 'blob'
import { read2 } from 'blob2'
const accessor = store()
export const data = (ctx: Parameters<typeof accessor>[0]): string => \`\${accessor(ctx).title()}-\${read()}-\${read2()}\`
`;

const fixture = (): Tree => ({
  ...serverDepsProject({
    deployables: { api: ["a"] },
    modules: [{ id: "a", deps: [STORE], extra: loaderModule("a", DATA) }],
    libraries: [dataLibrary({ bin: true })],
    dependencies: { blob: "1.0.0", blob2: "1.0.0" },
  }),
  [`${PKG}/package.json`]: pkgJson("blob"),
  [`${PKG}/index.js`]: indexJs("0"),
  [`${PKG}/index.d.ts`]: "export declare function read(): number\n",
  [`${PKG}/lib/deep.js`]: deepJs("0"),
  [`${PKG}/folder/a.txt`]: "folder-a\n",
  [`${PKG}/folder/sub/b.txt`]: "folder-b\n",
  [`${PKG2}/package.json`]: pkgJson("blob2"),
  [`${PKG2}/index.js`]: blob2Js,
  [`${PKG2}/index.d.ts`]: "export declare function read2(): number\n",
});
const BYTES = (): Record<string, Uint8Array> => ({
  [`${PKG}/blob.bin`]: bin(BLOB, Uint8Array.of(0)),
  [`${PKG}/other.bin`]: bin(OTHER, Uint8Array.of(1)),
  [`${PKG}/lib/deep.bin`]: bin(DEEP, Uint8Array.of(2)),
  [`${PKG}/wasm/x.bin`]: bin(WASM, Uint8Array.of(3)),
  [`${PKG}/dup.bin`]: bin(DUP, Uint8Array.of(4)),
  [`${PKG}/tpl.bin`]: bin(TPL, Uint8Array.of(5)),
  [`${PKG}/root.bin`]: bin(ROOT, Uint8Array.of(6)),
  [`${PKG2}/dup.bin`]: bin(DUP, Uint8Array.of(4)),
});

/** The E1014 records of a run's json output: location and message. */
function e1014(out: string): { path: string; message: string }[] {
  const found: { path: string; message: string }[] = [];
  for (const line of out.split("\n")) {
    if (!line.startsWith("{")) continue;
    let o: unknown;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof o !== "object" || o === null || Reflect.get(o, "code") !== "E1014") continue;
    const path = Reflect.get(o, "path");
    const message = Reflect.get(o, "message");
    found.push({ path: typeof path === "string" ? path : "", message: typeof message === "string" ? message : "" });
  }
  return found;
}

/** Applies `edits` (text) and `bytes`, removes `drop`, sets any `dist/` aside, runs `keel build`, then puts every touched path and the earlier `dist/` back. */
function attempt(
  dir: string,
  edits: Tree,
  bytes: Record<string, Uint8Array> = {},
  drop: string[] = [],
): { status: number | null; out: string; dist: boolean; found: ReturnType<typeof e1014> } {
  const touched = [...Object.keys(edits), ...Object.keys(bytes), ...drop];
  const before = new Map(touched.map((p) => [p, bytesAt(dir, p)]));
  const kept = `${dir}-dist-kept`;
  const hadDist = existsSync(join(dir, "dist"));
  if (hadDist) {
    rmSync(kept, { recursive: true, force: true });
    renameSync(join(dir, "dist"), kept);
  }
  try {
    for (const [p, text] of Object.entries(edits)) {
      mkdirSync(dirname(join(dir, p)), { recursive: true });
      writeFileSync(join(dir, p), text);
    }
    writeBytes(dir, bytes);
    for (const p of drop) rmSync(join(dir, p), { force: true });
    const r = keelRun(dir, ["build"]);
    return { ...r, dist: existsSync(join(dir, "dist/api")), found: e1014(r.out) };
  } finally {
    for (const [p, was] of before) {
      if (was === undefined) rmSync(join(dir, p), { force: true });
      else {
        mkdirSync(dirname(join(dir, p)), { recursive: true });
        writeFileSync(join(dir, p), was);
      }
    }
    rmSync(join(dir, "dist"), { recursive: true, force: true });
    if (hadDist) renameSync(kept, join(dir, "dist"));
  }
}

/** k.check's clip rule at `width` units: a longer value keeps `width - 3` units (one fewer before the first half of a pair), then `...`. */
const clipTo = (n: string, width: number): string => {
  if (n.length <= width) return n;
  const code = n.charCodeAt(width - 4);
  return `${n.slice(0, code >= 0xd800 && code <= 0xdbff ? width - 4 : width - 3)}...`;
};

const same = (a: Uint8Array | undefined, b: Uint8Array | undefined): boolean =>
  a !== undefined && b !== undefined && Buffer.from(a).equals(Buffer.from(b));
const topLevel = (dir: string): string[] =>
  existsSync(join(dir, "dist/api")) ? readdirSync(join(dir, "dist/api")) : [];

let dir = "";
let first: ReturnType<typeof built> = { status: null, out: "" };
let firstTop: string[] = [];
beforeAll(() => {
  dir = materialize(fixture());
  writeBytes(dir, BYTES());
  first = built(dir);
  firstTop = topLevel(dir);
}, SLOW);
afterAll(() => cleanup(dir));

const only = (r: ReturnType<typeof attempt>, path: string, message: RegExp | string): void => {
  expect(r.status, r.out).toBe(1);
  expect(r.found, r.out).toHaveLength(1);
  expect(r.found[0]?.path).toBe(path);
  if (typeof message === "string") expect(r.found[0]?.message).toBe(message);
  else expect(r.found[0]?.message).toMatch(message);
  expect((r.found[0]?.message ?? "").length).toBeLessThanOrEqual(89);
  expect(r.dist).toBe(false);
};

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

  test("a library's file under `node_modules` is a bundled package file: `@acme/store`'s `src/store.ts` names `./store.bin`, copied beside `server.mjs`", () => {
    expect(textAt(dir, "dist/api/store.bin")).toBe(STORE_BIN);
  });

  test("a copied file is copied byte for byte, and the file it was copied from stays where it is (property over the files' bytes)", () => {
    const names = ["blob.bin", "other.bin", "dup.bin", "tpl.bin"];
    fc.assert(
      fc.property(fc.constantFrom(...names), (f) => {
        expect(same(bytesAt(dir, `dist/api/${f}`), bytesAt(dir, `${PKG}/${f}`))).toBe(true);
      }),
      { seed: SEED, numRuns: 8 },
    );
  });

  test(
    "with `other.bin` deleted, `keel build` fails with one E1014 naming `node_modules/blob/index.js` and `other.bin`, and writes no `dist/<name>/`",
    () => {
      const r = attempt(dir, {}, {}, [`${PKG}/other.bin`]);
      only(r, "node_modules/blob/index.js", "reads other.bin, which is missing");
    },
    SLOW,
  );
});

describe(`k.server-deps 6: ${CLAUSE_6}`, () => {
  test("`node_modules/blob/lib/deep.js` holding `new URL('deep.bin', import.meta.url)` makes `keel build` write `dist/<name>/deep.bin` from `lib/`", () => {
    expect(same(bytesAt(dir, "dist/api/deep.bin"), DEEP)).toBe(true);
    expect(existsSync(join(dir, "dist/api/lib"))).toBe(false);
  });

  test("`new URL('./wasm/x.bin', import.meta.url)` in `index.js` writes `dist/<name>/wasm/x.bin`", () => {
    expect(same(bytesAt(dir, "dist/api/wasm/x.bin"), WASM)).toBe(true);
  });

  test("a template literal without an expression names a path as a string literal does: ``new URL(`./tpl.bin`, import.meta.url)`` writes `dist/<name>/tpl.bin`", () => {
    expect(same(bytesAt(dir, "dist/api/tpl.bin"), TPL)).toBe(true);
  });

  test("a path that names a folder copies the folder at the same path: `new URL('./folder', import.meta.url)` writes `dist/<name>/folder/a.txt` and `folder/sub/b.txt`", () => {
    expect(textAt(dir, "dist/api/folder/a.txt")).toBe("folder-a\n");
    expect(textAt(dir, "dist/api/folder/sub/b.txt")).toBe("folder-b\n");
  });

  test("`new URL('https://example.com/x', import.meta.url)` and `new URL('.', import.meta.url)` (and `'./'`) copy nothing and fail nothing", () => {
    expect(first.status, first.out).toBe(0);
    for (const entry of ["package.json", "index.js", "index.d.ts", "lib", "example.com", "https:"])
      expect(firstTop, entry).not.toContain(entry);
    expect(e1014(first.out)).toEqual([]);
  });

  test("a `new URL(x, <another base>)` is not read: its `x`, which names no file, fails nothing", () => {
    expect(first.status, first.out).toBe(0);
    expect(firstTop).not.toContain("no-such-file.bin");
  });

  test("two bundled package files naming one path for files of equal bytes copy it once: `dup.bin` of `blob` and of `blob2`", () => {
    expect(same(bytesAt(dir, "dist/api/dup.bin"), DUP)).toBe(true);
    expect(firstTop.filter((f) => f === "dup.bin")).toHaveLength(1);
  });

  test("a file is never renamed or moved: the bundle is not rewritten, and each copied file is still beside the file that names it", () => {
    for (const f of ["blob.bin", "other.bin", "dup.bin", "tpl.bin", "lib/deep.bin", "wasm/x.bin"])
      expect(existsSync(join(dir, PKG, f)), f).toBe(true);
    expect(existsSync(join(dir, "dist/api/dup.bin"))).toBe(true);
  });

  test(
    "`new URL('../up.bin', import.meta.url)` makes `keel build` fail with one E1014 naming `node_modules/blob/index.js`, and no `dist/<name>/`",
    () => {
      const r = attempt(dir, { [`${PKG}/index.js`]: indexJs("new URL('../up.bin', import.meta.url)") });
      only(r, "node_modules/blob/index.js", "reads ../up.bin, outside its own folder");
    },
    SLOW,
  );

  test(
    "`new URL(name, import.meta.url)` makes `keel build` fail with one E1014 naming `node_modules/blob/index.js`, and no `dist/<name>/`",
    () => {
      const r = attempt(dir, {
        [`${PKG}/index.js`]: `const name = 'other'\n${indexJs("new URL(name, import.meta.url)")}`,
      });
      only(r, "node_modules/blob/index.js", "reads new URL(x, import.meta.url) with x no string literal");
    },
    SLOW,
  );

  test(
    "``new URL(`./${name}.bin`, import.meta.url)`` makes `keel build` fail with one E1014 naming `node_modules/blob/index.js`, and no `dist/<name>/`",
    () => {
      const r = attempt(dir, {
        [`${PKG}/index.js`]: `const name = 'other'\n${indexJs("new URL(`./${name}.bin`, import.meta.url)")}`,
      });
      only(r, "node_modules/blob/index.js", "reads new URL(x, import.meta.url) with x no string literal");
    },
    SLOW,
  );

  test(
    "a path that leaves the file's folder even inside the package (`../root.bin` in `lib/deep.js`) and an absolute one (`/x.bin`) are each one E1014 at the file naming it, and a path that is missing is one, its `<f>` clipped to 40 units",
    () => {
      const long = fc.sample(fc.stringMatching(/^[a-z]{44,60}$/), { seed: SEED, numRuns: 1 })[0] ?? "x".repeat(50);
      const gone = `${long}.bin`;
      const r = attempt(dir, {
        [`${PKG}/lib/deep.js`]: deepJs("new URL('../root.bin', import.meta.url)"),
        [`${PKG}/index.js`]: indexJs(`new URL('/x.bin', import.meta.url), new URL('${gone}', import.meta.url)`),
      });
      expect(r.status, r.out).toBe(1);
      expect(r.dist).toBe(false);
      const byMessage = new Map(r.found.map((f) => [f.message, f.path]));
      expect(r.found).toHaveLength(3);
      expect(byMessage.get("reads ../root.bin, outside its own folder")).toBe("node_modules/blob/lib/deep.js");
      expect(byMessage.get("reads /x.bin, outside its own folder")).toBe("node_modules/blob/index.js");
      expect(byMessage.get(`reads ${clipTo(gone, 40)}, which is missing`)).toBe("node_modules/blob/index.js");
      for (const f of r.found) expect(f.message.length).toBeLessThanOrEqual(89);
    },
    SLOW,
  );

  test(
    "two packages naming one path for files of different bytes (`dup.bin` of `blob` and of `blob2`) are one E1014, `<other>` clipped to 36 units, and write no `dist/<name>/`",
    () => {
      const r = attempt(dir, {}, { [`${PKG2}/dup.bin`]: Uint8Array.of(9, 9, 9, 9) });
      expect(r.status, r.out).toBe(1);
      expect(r.found, r.out).toHaveLength(1);
      expect(r.dist).toBe(false);
      const [a, b] = ["node_modules/blob/index.js", "node_modules/blob2/index.js"];
      const f = r.found[0];
      expect([a, b]).toContain(f?.path);
      const other = f?.path === a ? b : a;
      expect(f?.message).toBe(`reads dup.bin, as ${clipTo(other ?? "", 36)} reads another file`);
      expect((f?.message ?? "").length).toBeLessThanOrEqual(89);
    },
    SLOW,
  );
});

// ---- clause 9: a library whose real folder is outside the project, inside it, and two libraries naming one path ----
const STORE_TS = "node_modules/@acme/store/src/store.ts";
const DATA_STORE = `import { store } from '${STORE}'
const accessor = store()
export const data = (ctx: Parameters<typeof accessor>[0]): string => accessor(ctx).title()
`;
const storeTree = (): Tree =>
  serverDepsProject({
    deployables: { api: ["a"] },
    modules: [{ id: "a", deps: [STORE], extra: loaderModule("a", DATA_STORE) }],
    libraries: [dataLibrary({ bin: true })],
  });

describe(`k.server-deps 9: ${CLAUSE_9}`, () => {
  let linked = "";
  let beside = "";
  let linkedBuild: ReturnType<typeof built> = { status: null, out: "" };
  beforeAll(() => {
    linked = materialize(storeTree());
    beside = linkBeside(linked, STORE);
    linkedBuild = built(linked);
  }, SLOW);
  afterAll(() => {
    cleanup(linked);
    cleanup(beside);
  });

  test("a library linked through a workspace, its real folder outside the project, whose `src/store.ts` holds `new URL('./store.bin', import.meta.url)`: `keel build` writes `dist/<name>/store.bin`", () => {
    expect(linkedBuild.status, linkedBuild.out).toBe(0);
    expect(textAt(linked, "dist/api/store.bin")).toBe(STORE_BIN);
  });

  test(
    "the built server finds the file at run time: `node dist/api/server.mjs` answers the loader that reads `store.bin` through the library",
    async () => {
      expect(linkedBuild.status, linkedBuild.out).toBe(0);
      await withServer(linked, "api", {}, async (port) => {
        const res = await send(port, "GET", "/api/a/one", { accept: "application/json" });
        expect(res.status, res.body).toBe(200);
        expect(res.body).toContain(STORE_BIN.trim());
      });
    },
    SLOW,
  );

  test(
    "with `store.bin` deleted it fails with one E1014 naming `node_modules/@acme/store/src/store.ts`, and writes no `dist/<name>/`",
    () => {
      const r = attempt(linked, {}, {}, ["node_modules/@acme/store/src/store.bin"]);
      only(r, STORE_TS, /^reads (\.\/)?store\.bin, which is missing$/);
    },
    SLOW,
  );
});

// Two libraries, each shipping `data.bin` and reading it through `new URL('./data.bin', import.meta.url)`.
const plainLib = (name: string, id: string, fn: string): Tree => {
  const root = `node_modules/${name}`;
  return {
    [`${root}/package.json`]: JSON.stringify({
      name,
      version: "1.0.0",
      type: "module",
      keel: "library",
      exports: { ".": { keel: "./src/index.ts", default: "./index.js" } },
    }),
    [`${root}/index.js`]: "export {}\n",
    [`${root}/module.ts`]: manifestOf(id, [], [fn]),
    [`${root}/src/index.ts`]: `export { ${fn} } from './${fn}.ts'\n`,
    [`${root}/src/${fn}.ts`]: `export const ${fn} = (): string => new URL('./data.bin', import.meta.url).href\n`,
    [`${root}/.keel/ledger.json`]: LEDGER,
  };
};
const DATA_TWO = `import { one } from '@acme/one'
import { two } from '@acme/two'
export const data = (_ctx: unknown): string => String(one() + two())
`;

const DATA_ONE = `import { one } from '@acme/one'
export const data = (_ctx: unknown): string => String(one())
`;
const ONE_FILE = "node_modules/@acme/one/src/one.ts";

describe("k.server-deps Files a bundled package reads: a library's file is read wherever its real folder is, and named at `node_modules/<name>/<f>`", () => {
  let inside = "";
  let insideBuild: ReturnType<typeof built> = { status: null, out: "" };
  const ONE_BYTES = bin(SAMPLED[7], Uint8Array.of(8, 8));
  beforeAll(() => {
    inside = materialize(
      serverDepsProject({
        deployables: { api: ["a"] },
        modules: [{ id: "a", deps: ["@acme/one"], extra: loaderModule("a", DATA_ONE) }],
        libraries: [plainLib("@acme/one", "one", "one")],
      }),
    );
    writeBytes(inside, { "node_modules/@acme/one/src/data.bin": ONE_BYTES });
    linkInside(inside, "libs/one", "@acme/one");
    insideBuild = built(inside);
  }, SLOW);
  afterAll(() => cleanup(inside));

  test("a library whose real folder is inside the project (`libs/one`, linked as `node_modules/@acme/one`): `keel build` writes `dist/<name>/data.bin`", () => {
    expect(insideBuild.status, insideBuild.out).toBe(0);
    expect(same(bytesAt(inside, "dist/api/data.bin"), ONE_BYTES)).toBe(true);
  });

  test(
    "with `data.bin` deleted, the E1014 names `node_modules/@acme/one/src/one.ts`, not the real path under `libs/one`",
    () => {
      const r = attempt(inside, {}, {}, ["libs/one/src/data.bin"]);
      only(r, ONE_FILE, /^reads (\.\/)?data\.bin, which is missing$/);
    },
    SLOW,
  );
});

describe(`k.server-deps 9, two libraries: ${CLAUSE_9}`, () => {
  let both = "";
  let equalBuild: ReturnType<typeof built> = { status: null, out: "" };
  const BYTES_ONE = bin(DUP, Uint8Array.of(7, 7));
  beforeAll(() => {
    both = materialize(
      serverDepsProject({
        deployables: { api: ["a"] },
        modules: [{ id: "a", deps: ["@acme/one", "@acme/two"], extra: loaderModule("a", DATA_TWO) }],
        libraries: [plainLib("@acme/one", "one", "one"), plainLib("@acme/two", "two", "two")],
      }),
    );
    writeBytes(both, {
      "node_modules/@acme/one/src/data.bin": BYTES_ONE,
      "node_modules/@acme/two/src/data.bin": BYTES_ONE,
    });
    equalBuild = built(both);
  }, SLOW);
  afterAll(() => cleanup(both));

  test("two libraries each shipping a `data.bin` of equal bytes copy it once: `keel build` writes one `dist/<name>/data.bin`", () => {
    expect(equalBuild.status, equalBuild.out).toBe(0);
    expect(same(bytesAt(both, "dist/api/data.bin"), BYTES_ONE)).toBe(true);
  });

  test(
    "two libraries each shipping a `data.bin` of other bytes fail `keel build` with one E1014, and write no `dist/<name>/`",
    () => {
      const r = attempt(both, {}, { "node_modules/@acme/two/src/data.bin": Uint8Array.of(1, 2, 3, 4, 5) });
      expect(r.status, r.out).toBe(1);
      expect(r.found, r.out).toHaveLength(1);
      expect(r.dist).toBe(false);
      const paths = ["node_modules/@acme/one/src/one.ts", "node_modules/@acme/two/src/two.ts"];
      expect(paths).toContain(r.found[0]?.path);
      const other = paths.find((p) => p !== r.found[0]?.path) ?? "";
      const tail = clipTo(other, 36).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(r.found[0]?.message).toMatch(new RegExp(`^reads (\\./)?data\\.bin, as ${tail} reads another file$`));
      expect((r.found[0]?.message ?? "").length).toBeLessThanOrEqual(89);
    },
    SLOW,
  );
});
