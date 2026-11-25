// Spec: k.check-cache, clause "In a project whose `package.json` is `{\"name\":\"p\",\"private\":true,\"type\":\"module\"}`, with `node_modules/foo/package.json` `{\"name\":\"foo\",\"types\":\"index.d.ts\"}`, `node_modules/foo/index.d.ts` `export declare const n: number` and `modules/a/a.ts` `import { n } from 'foo'`, an empty line and `export const a: number = n`, a first `keel check` reports no diagnostic; after it, each of these changes makes the next `keel check --format=json` print the same bytes to stdout, and exit with the same code, as a run with `node_modules/.cache/keel` deleted, and report one E1751 at `modules/a/a.ts` line 3: `index.d.ts` rewritten to `export declare const n: string` with its modification time set back to the one it had; `node_modules/foo/other.d.ts` holding `export declare const n: string` and `package.json`'s `types` changed to `other.d.ts`."
// Spec: k.check-cache, clause "In that project with `modules/a/a.ts` importing `n` from `'foo/sub'` and `node_modules/foo/sub.d.ts` holding `export declare const n: number`, after one `keel check`, adding `node_modules/foo/sub.ts` holding `export const n: string = 's'` makes the next `keel check` report one E1751 at `modules/a/a.ts` line 3, and deleting `node_modules/foo/sub.d.ts` instead makes its stdout the same bytes as a run with `node_modules/.cache/keel` deleted."
// Spec: k.check-cache, clause "In that project with `node_modules/foo` a symbolic link to a folder `../foo` beside the project holding the same two files, after one `keel check`, rewriting `../foo/index.d.ts` to `export declare const n: string` with its old modification time makes the next `keel check` report one E1751 at `modules/a/a.ts` line 3."
// Spec: k.check-cache, clause "For 4 generated sequences (seed 1337) of 1 to 3 edits to that project, each one of: rewriting `modules/a/a.ts` with `number` or `string` as the type of `a`; rewriting `node_modules/foo/index.d.ts` with `number` or `string` as the type of `n`, its modification time set back to the old one; adding or deleting `node_modules/foo/other.d.ts`; setting `package.json`'s `types` to `index.d.ts` or `other.d.ts`: after each edit, `keel check --format=json` with `node_modules/.cache/keel` as the previous run left it prints the same stdout bytes and exits with the same code as the run that follows it with the folder deleted."
// Spec: k.check-cache, clause "In that project, after one `keel check`, replacing each file in `node_modules/.cache/keel` with its first 40 bytes, or with `{}`, leaves the next `keel check --format=json` printing the same stdout bytes and exit code as a run with the folder deleted, and after it every file in the folder parses as JSON."
// Spec: k.check-cache, clause "In that project, with an empty `node_modules/.cache/keel`, `keel check` with `modules/a/a.ts` declaring `a: number`, then with it declaring `a: string` (`n` still `number`), leaves two entry files; with the two files' contents swapped, `keel check` of each of the two trees prints the same stdout bytes and exits with the same code as a run with the folder deleted."
// Spec: k.check-cache, clause "`keel check` in that project with `node_modules` removed leaves no `node_modules` folder."
// Seed 1337. The real binary over scratch projects under a realpath'd temp folder. Time is only ever set with `utimesSync` to a fixed past second (OLD).
// The review of RFC 0226 showed each stale-reuse hole on the earlier build: the cases "mtime kept", "dependency package.json", "shadowing file",
// "link target gains a file", "link target package.json", "deleted file" and "truncated entry" are those holes as exact cases.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";

// Seed 1337 (recorded).
const SEED = 1337;
/** Each test declares its bound (docs/TESTING.md Wall-clock bounds); the watchdog kills at twice it plus 30 s. */
const SLOW = 120_000;
const SLOW_PROPERTY = 240_000;
const BIN = join(dirname(fileURLToPath(import.meta.url)), "../src/bin.ts");
const OLD = 1_700_000_000;
const CACHE = "node_modules/.cache/keel";

type Out = { stdout: string; status: number | null };
type Project = { base: string; dir: string; foo: string };

const bases: string[] = [];
afterAll(() => {
  for (const b of bases) rmSync(b, { recursive: true, force: true });
});

/** Write `text` at `path` (folders made) and set its times to OLD. */
function put(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  utimesSync(path, OLD, OLD);
}

const A = (type: string, spec = "foo") => `import { n } from '${spec}'\n\nexport const a: ${type} = n\n`;
const DTS = (type: string) => `export declare const n: ${type}\n`;
const PKG = (types: string) => `{"name":"foo","types":"${types}"}\n`;

/** The project of the clause; with `link`, `node_modules/foo` is a symbolic link to `<base>/foo`. */
function project(opts: { link?: boolean; spec?: string; sub?: boolean } = {}): Project {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "keel-check-cache-")));
  bases.push(base);
  const dir = join(base, "proj");
  const foo = opts.link === true ? join(base, "foo") : join(dir, "node_modules/foo");
  put(join(dir, "package.json"), '{"name":"p","private":true,"type":"module"}\n');
  put(join(dir, "modules/a/a.ts"), A("number", opts.spec ?? "foo"));
  put(join(foo, "package.json"), PKG("index.d.ts"));
  put(join(foo, "index.d.ts"), DTS("number"));
  if (opts.sub === true) put(join(foo, "sub.d.ts"), DTS("number"));
  if (opts.link === true) {
    mkdirSync(join(dir, "node_modules"), { recursive: true });
    symlinkSync(foo, join(dir, "node_modules/foo"));
  }
  return { base, dir, foo };
}

function keel(dir: string, args: string[] = []): Out {
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST") continue;
    env[k] = v;
  }
  const r = spawnSync(process.execPath, [BIN, "check", "--format=json", ...args], { cwd: dir, encoding: "utf8", env });
  return { stdout: r.stdout, status: r.status };
}

/** A run with the cache folder deleted first. */
function cold(dir: string): Out {
  rmSync(join(dir, CACHE), { recursive: true, force: true });
  return keel(dir);
}

type Rec = { kind?: unknown; code?: unknown; path?: unknown; line?: unknown };
function records(out: Out): Rec[] {
  const recs: Rec[] = [];
  for (const line of out.stdout.split("\n")) {
    if (line.trim() === "") continue;
    const v: unknown = JSON.parse(line);
    if (typeof v === "object" && v !== null) recs.push(v);
  }
  return recs;
}
const diagnostics = (out: Out): Rec[] => records(out).filter((r) => r.kind === "diag");

/** One E1751, at `modules/a/a.ts` line 3. */
function expectOneE1751(out: Out): void {
  const found = diagnostics(out).filter((d) => d.code === "E1751");
  expect(found).toHaveLength(1);
  expect(found[0]?.path).toBe("modules/a/a.ts");
  expect(found[0]?.line).toBe(3);
}

/** The first `keel check`: no diagnostic, exit 0, and an entry on disk. */
function first(dir: string): void {
  const out = keel(dir);
  expect(diagnostics(out)).toEqual([]);
  expect(out.status).toBe(0);
  expect(readdirSync(join(dir, CACHE)).length).toBeGreaterThan(0);
}

/** The warm run after a change prints what a run with the folder deleted prints; the warm output is returned. */
function warmEqualsCold(dir: string): Out {
  const warm = keel(dir);
  const fresh = cold(dir);
  expect(warm.stdout).toBe(fresh.stdout);
  expect(warm.status).toBe(fresh.status);
  return warm;
}

describe("k.check-cache #1: a changed file, a changed dependency package.json", () => {
  test(
    "`index.d.ts` rewritten to `export declare const n: string` with its modification time set back to the one it had: the same bytes and exit code as a run with the cache deleted, one E1751 at `modules/a/a.ts` line 3 (mtime kept)",
    () => {
      const p = project();
      first(p.dir);
      put(join(p.foo, "index.d.ts"), DTS("string"));
      expectOneE1751(warmEqualsCold(p.dir));
    },
    SLOW,
  );

  test(
    "`node_modules/foo/other.d.ts` holding `export declare const n: string` and `package.json`'s `types` changed to `other.d.ts`: the same bytes and exit code as a run with the cache deleted, one E1751 at `modules/a/a.ts` line 3 (dependency package.json)",
    () => {
      const p = project();
      first(p.dir);
      put(join(p.foo, "other.d.ts"), DTS("string"));
      put(join(p.foo, "package.json"), PKG("other.d.ts"));
      expectOneE1751(warmEqualsCold(p.dir));
    },
    SLOW,
  );

  test(
    "a deleted file: removing `node_modules/foo/index.d.ts` prints the same bytes and exit code as a run with the cache deleted",
    () => {
      const p = project();
      first(p.dir);
      rmSync(join(p.foo, "index.d.ts"));
      const warm = warmEqualsCold(p.dir);
      expect(warm.status).toBe(1);
    },
    SLOW,
  );
});

describe("k.check-cache #2: a new file that shadows a resolution", () => {
  test(
    "after one `keel check`, adding `node_modules/foo/sub.ts` holding `export const n: string = 's'` makes the next `keel check` report one E1751 at `modules/a/a.ts` line 3",
    () => {
      const p = project({ spec: "foo/sub", sub: true });
      first(p.dir);
      put(join(p.foo, "sub.ts"), "export const n: string = 's'\n");
      const warm = keel(p.dir);
      expectOneE1751(warm);
      const fresh = cold(p.dir);
      expect(warm.stdout).toBe(fresh.stdout);
      expect(warm.status).toBe(fresh.status);
    },
    SLOW,
  );

  test(
    "after one `keel check`, deleting `node_modules/foo/sub.d.ts` makes its stdout the same bytes as a run with `node_modules/.cache/keel` deleted",
    () => {
      const p = project({ spec: "foo/sub", sub: true });
      first(p.dir);
      rmSync(join(p.foo, "sub.d.ts"));
      const warm = keel(p.dir);
      const fresh = cold(p.dir);
      expect(warm.stdout).toBe(fresh.stdout);
      expect(warm.status).toBe(fresh.status);
    },
    SLOW,
  );
});

describe("k.check-cache #3: a workspace link", () => {
  test(
    "`../foo/index.d.ts` rewritten to `export declare const n: string` with its old modification time makes the next `keel check` report one E1751 at `modules/a/a.ts` line 3",
    () => {
      const p = project({ link: true });
      first(p.dir);
      put(join(p.foo, "index.d.ts"), DTS("string"));
      const warm = keel(p.dir);
      expectOneE1751(warm);
      expect(warm.stdout).toBe(cold(p.dir).stdout);
    },
    SLOW,
  );

  test(
    "a link target gaining a file that shadows a resolution (`foo/sub.ts` beside `sub.d.ts`) is seen: the same bytes and exit code as a run with the cache deleted, one E1751",
    () => {
      const p = project({ link: true, spec: "foo/sub", sub: true });
      first(p.dir);
      put(join(p.foo, "sub.ts"), "export const n: string = 's'\n");
      expectOneE1751(warmEqualsCold(p.dir));
    },
    SLOW,
  );

  test(
    "a link target's `package.json` with `types` changed is seen: the same bytes and exit code as a run with the cache deleted, one E1751",
    () => {
      const p = project({ link: true });
      first(p.dir);
      put(join(p.foo, "other.d.ts"), DTS("string"));
      put(join(p.foo, "package.json"), PKG("other.d.ts"));
      expectOneE1751(warmEqualsCold(p.dir));
    },
    SLOW,
  );
});

type Edit =
  | { k: "a"; type: "number" | "string" }
  | { k: "dts"; type: "number" | "string" }
  | { k: "other"; on: boolean }
  | { k: "types"; to: "index.d.ts" | "other.d.ts" }
  | { k: "abar" }
  | { k: "pkg"; on: boolean }
  | { k: "deps"; on: boolean };
const type = fc.constantFrom<"number" | "string">("number", "string");
const edit: fc.Arbitrary<Edit> = fc.oneof(
  type.map((t): Edit => ({ k: "a", type: t })),
  type.map((t): Edit => ({ k: "dts", type: t })),
  fc.boolean().map((on): Edit => ({ k: "other", on })),
  fc.constantFrom<"index.d.ts" | "other.d.ts">("index.d.ts", "other.d.ts").map((to): Edit => ({ k: "types", to })),
  fc.constant<Edit>({ k: "abar" }),
  fc.boolean().map((on): Edit => ({ k: "pkg", on })),
  fc.boolean().map((on): Edit => ({ k: "deps", on })),
);
const MANIFEST = (id: string, deps: string[]) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [${deps.map((d) => `'${d}'`).join(", ")}], capabilities: [], public: { exports: [] } })\n`;

function apply(p: Project, e: Edit): void {
  if (e.k === "a") put(join(p.dir, "modules/a/a.ts"), A(e.type));
  else if (e.k === "dts") put(join(p.foo, "index.d.ts"), DTS(e.type));
  else if (e.k === "other") {
    if (e.on) put(join(p.foo, "other.d.ts"), DTS("string"));
    else rmSync(join(p.foo, "other.d.ts"), { force: true });
  } else if (e.k === "types") put(join(p.foo, "package.json"), PKG(e.to));
  else if (e.k === "abar")
    put(join(p.dir, "modules/a/a.ts"), "import { m } from 'bar'\n\nexport const a: string = m\n");
  else if (e.k === "pkg") {
    const bar = join(p.dir, "node_modules/bar");
    if (e.on) {
      put(join(bar, "package.json"), '{"name":"bar","types":"index.d.ts"}\n');
      put(join(bar, "index.d.ts"), "export declare const m: string\n");
    } else rmSync(bar, { recursive: true, force: true });
  } else {
    put(join(p.dir, "modules/a/module.ts"), MANIFEST("a", e.on ? ["b"] : []));
    put(join(p.dir, "modules/b/module.ts"), MANIFEST("b", []));
  }
}

describe("k.check-cache #4: the law", () => {
  test(
    "for 4 generated sequences of 1 to 3 edits, after each edit `keel check --format=json` with the cache as the previous run left it prints the same stdout bytes and exits with the same code as the run that follows it with the folder deleted",
    () => {
      fc.assert(
        fc.property(fc.array(edit, { minLength: 1, maxLength: 3 }), (edits) => {
          const p = project();
          first(p.dir);
          for (const e of edits) {
            apply(p, e);
            warmEqualsCold(p.dir);
          }
          rmSync(p.base, { recursive: true, force: true });
        }),
        { seed: SEED, numRuns: 4 },
      );
    },
    SLOW_PROPERTY,
  );
});

describe("k.check-cache #5: a broken entry is a miss and is rewritten", () => {
  const damage: readonly (readonly [string, (text: string) => string])[] = [
    ["its first 40 bytes (a truncated entry)", (t) => t.slice(0, 40)],
    ["`{}`", () => "{}"],
  ];
  for (const [what, to] of damage) {
    test(
      `replacing each file in \`node_modules/.cache/keel\` with ${what} leaves the next \`keel check --format=json\` printing the same stdout bytes and exit code as a run with the folder deleted, and after it every file in the folder parses as JSON`,
      () => {
        const p = project();
        first(p.dir);
        const folder = join(p.dir, CACHE);
        for (const f of readdirSync(folder)) writeFileSync(join(folder, f), to(readFileSync(join(folder, f), "utf8")));
        const warm = keel(p.dir);
        const files = readdirSync(folder);
        expect(files.length).toBeGreaterThan(0);
        for (const f of files) expect(() => JSON.parse(readFileSync(join(folder, f), "utf8"))).not.toThrow();
        const fresh = cold(p.dir);
        expect(warm.stdout).toBe(fresh.stdout);
        expect(warm.status).toBe(fresh.status);
        expect(diagnostics(warm)).toEqual([]);
      },
      SLOW,
    );
  }
});

describe("k.check-cache #8: no node_modules, no cache", () => {
  test(
    "`keel check` in that project with `node_modules` removed leaves no `node_modules` folder",
    () => {
      for (const body of [A("number"), "export const a: number = 1\n"]) {
        const p = project();
        rmSync(join(p.dir, "node_modules"), { recursive: true, force: true });
        put(join(p.dir, "modules/a/a.ts"), body);
        keel(p.dir);
        expect(existsSync(join(p.dir, "node_modules"))).toBe(false);
      }
    },
    SLOW,
  );
});

describe("k.check-cache #9: an entry stores its key", () => {
  test(
    "with the two entry files' contents swapped, `keel check` of each of the two trees prints the same stdout bytes and exits with the same code as a run with the folder deleted",
    () => {
      for (const tree of ["number", "string"]) {
        const p = project();
        const folder = join(p.dir, CACHE);
        mkdirSync(folder, { recursive: true });
        put(join(p.dir, "modules/a/a.ts"), A("number"));
        keel(p.dir);
        put(join(p.dir, "modules/a/a.ts"), A("string"));
        keel(p.dir);
        const files = readdirSync(folder).sort();
        expect(files).toHaveLength(2);
        const [one, two] = files.map((f) => join(folder, f));
        if (one === undefined || two === undefined) throw new Error("two entry files expected");
        const [x, y] = [readFileSync(one, "utf8"), readFileSync(two, "utf8")];
        writeFileSync(one, y);
        writeFileSync(two, x);
        put(join(p.dir, "modules/a/a.ts"), A(tree));
        const warm = keel(p.dir);
        const fresh = cold(p.dir);
        expect(warm.stdout, tree).toBe(fresh.stdout);
        expect(warm.status, tree).toBe(fresh.status);
      }
    },
    SLOW,
  );
});
