// Spec: k.library-pack, Pack (the five steps): "`keel pack`, run in a library's folder, runs five steps: `kind`, `package`, `check` (`keel check`), `test` (`keel test`) and `ledger` (`keel ledger --write .keel/ledger.json`). It stops at the first step that fails, reports that step's own diagnostics and then one E1164 whose message begins with the step's name, and writes no file. On success it prints one summary record (`docs/OUTPUT.md`) whose `counts` are `{ unsafe, hostElements, exports }` of the ledger it wrote, `exports` the number of its entries, and writes `.keel/ledger.json` alone."
// Spec: k.library-pack, Pack (`--check`): "`keel pack --check` runs the same steps and writes nothing; its `ledger` step is E1164 when `.keel/ledger.json` is missing, fails its shape as an app reads it (Ledger file), or holds an `unsafe`, `hostElements` or `exports` other than the ones `keel pack` would write; other keys are not judged. Writing nothing, it changes nothing in the folder but under `node_modules/`, where the type cache lives (k.check-cache). A tarball is made by the package manager, whose `prepack` runs `keel pack --check`; it holds what `files` selects and what the package manager always packs (`package.json`, `README`, `LICENSE`), never a `node_modules` folder, and `keel pack` reads that list."
// Spec: k.library-pack, Pack (what an E1164 is): "By one rule, a library an app could not read, check or trust as its folder is read does not pack. Each E1164, whole within 89 units for a path, key or name of up to 28 units (40 for `kind`'s name), is at `package.json` for a field, its line and a column at the start of its value, at the file for a file, and nowhere for a step:"
// Spec: k.library-pack, Pack: "- `kind`: no `package.json` (`kind: no package.json here, so no library`, nowhere); one that is no JSON (`kind: package.json is not JSON`, at line 1); no `"keel": "library"` (`kind: package.json has no "keel": "library"`, at `keel`, else line 1); a name that is no scoped package name (k.library Kind: `kind: name "<name>" is no scoped package name`, at `name`)."
// Spec: k.library-pack, Pack: "- `package`, the first in this order, at the field: no root `module.ts` (`package has no root module.ts, the library's manifest`, at `keel`); an `exports` whose `"."` entry lists no `keel` condition first (`package exports "." lists no keel condition first`), an entry listing `keel` after another condition (`package exports "<key>" lists keel after another`), or a `keel` target that is no `.ts` or `.tsx` file under `src/` or `unsafe/` (`package exports "<key>" keel is no file under src/ or unsafe/`), at `exports`; no `files` (`package lists no files, so a tarball would hold everything`, at `keel`); a `files` that does not select `module.ts`, `.keel/ledger.json` or a file under `src/` or `unsafe/` (`package files omits <path>`) or an `exports` target (`package files omits <path>, exports "<key>"`), at `files`; a `@keel/*` package the files import, or the compiler's output of a `.tsx` file imports, that `dependencies` lists (`package dependencies lists <name>; a peer resolves to the app's`, at `dependencies`) or `peerDependencies` omits (`package peerDependencies omits <name>`, at `peerDependencies`, else `keel`); a tarball holding a `.env` file, whose secrets would leave with it (`package files ships <path>, a secret's file`), or the root `tokens.ts`, the library's own check fixture where an app reads its own (`package files ships tokens.ts; an app checks the library against its own`), at `files`. A `node_modules` folder is not judged: the package manager never packs one."
// Spec: k.library-pack, Pack: "- `check`: `check: <n> errors; nothing packed` (`1 error`), nowhere, after the check's diagnostics."
// Spec: k.library-pack, Pack: "- `test`: `test: <f> of <n> tests failed; nothing packed`, or `test: the run did not pass; nothing packed` when none failed, nowhere, after the test's diagnostics."
// Spec: k.library-pack, Pack: "- `ledger`: `ledger: .keel is not a folder` (at `.keel`) or `ledger: .keel/ledger.json cannot be written here` (at the file) when it cannot write; under `--check`, `ledger: .keel/ledger.json is missing; keel pack writes it` (nowhere), `ledger: .keel/ledger.json fails its shape; keel pack writes it again` and `ledger: .keel/ledger.json is stale at <field>; keel pack writes it again`, `<field>` the first of `unsafe`, `hostElements` and `exports` that differs (at the file, line 1)."
// Spec: k.library-pack, Rules: "E1164 `keel pack`: the step its message begins with failed (`kind`, `package`, `check`, `test`, `ledger`; Pack); nothing is written."
// Seed: 1337 (the order property over pairs of `package` refusals; every other case is an example). Binary runs: 1 scaffold and 1 `keel pack` shared by the cases that copy the folder;
// each `package` and `kind` refusal runs `keel pack` then `keel pack --check` once (they stop before `keel check`: about 1 s each); each `check`, `test` and `ledger` refusal runs the steps up to its own once.
// ASSUMPTIONS (spec silent, readings asserted):
//  - "at the file" is `path` the file's repository path, and a "column at the start of its value" the 1-based column after `"<key>": ` on the key's line, `package.json` written as `JSON.stringify(value, null, 2)` (keys at two spaces).
//  - "nowhere" is a record with no `path` and no `line`.
//  - `package files omits <path>` for a file under `src/`: `<path>` is the repository path of one file under it (`src/Example.tsx` or `src/index.ts`); for an `exports` target the `types` or `default` file of the entry.
//  - the order of the `exports` messages among themselves and of the two `dependencies`/`peerDependencies` messages is not asserted (the spec lists them in one clause); the order property compares clauses.
//  - `package peerDependencies omits <name>` with no `peerDependencies` at all names one of the five `@keel/*` packages the files import, at `keel`.
//  - `.keel/ledger.json cannot be written here` is made with a `.keel` folder without write permission.
import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";
import type { Rec, Run } from "./compat-support.ts";
import {
  CLEAN_UNSAFE,
  SLOW,
  cleanup,
  cloneLibrary,
  exampleWithHost,
  isRecord,
  materialize,
  pack,
  readJson,
  readText,
  scaffolded,
  snapshot,
  str,
  writeExample,
} from "./library-support.ts";

const SEED = 1337;
const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});

let base: ReturnType<typeof scaffolded> | undefined;
function pristine(): ReturnType<typeof scaffolded> {
  if (base === undefined) {
    base = scaffolded();
    made.push(base.scratchDir);
  }
  return base;
}
const fresh = (): string => cloneLibrary(pristine().lib);
let packedLib: string | undefined;
/** A copy of the scaffolded library after `keel pack`, the packed one never edited. */
const packedCopy = (): string => {
  if (packedLib === undefined) {
    packedLib = fresh();
    expect(pack(packedLib).status).toBe(0);
  }
  return cloneLibrary(packedLib);
};

type Pkg = Record<string, unknown>;
const objOf = (v: unknown): Pkg => (isRecord(v) ? v : {});
const listOf = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const readPkg = (lib: string): Pkg => objOf(readJson(lib, "package.json"));
const writePkg = (lib: string, pkg: Pkg): string => {
  const text = `${JSON.stringify(pkg, null, 2)}\n`;
  writeFileSync(join(lib, "package.json"), text);
  return text;
};
const without = (o: Pkg, key: string): Pkg => Object.fromEntries(Object.entries(o).filter(([k]) => k !== key));

/** Where the value of top-level `key` starts in `text` as `JSON.stringify(value, null, 2)` writes it: line and 1-based column. */
function valueAt(text: string, key: string): { line: number; col: number } {
  const m = new RegExp(`^  "${key}": `, "m").exec(text);
  if (m === null) throw new Error(`no key ${key}`);
  return { line: text.slice(0, m.index).split("\n").length, col: m[0].length + 1 };
}

const e1164 = (r: Run): Rec[] => r.records.filter((x) => x.kind === "diag" && x.code === "E1164");

type Where = "nowhere" | { path: string; line?: number; col?: number };
/** `r` is exit 1 with exactly one E1164 of `message` at `where`, after every other diagnostic, and the folder is as `before` byte for byte. */
function expectRefusal(
  lib: string,
  before: Record<string, string>,
  r: Run,
  message: string | RegExp,
  where: Where,
): void {
  const found = e1164(r);
  const shown = JSON.stringify(r.records).slice(0, 900);
  expect(found.length, shown).toBe(1);
  const rec = found[0];
  if (typeof message === "string") expect(rec?.message, shown).toBe(message);
  else expect(str(rec?.message), shown).toMatch(message);
  if (where === "nowhere") {
    expect(rec?.path, shown).toBeUndefined();
    expect(rec?.line, shown).toBeUndefined();
  } else expect(rec, shown).toMatchObject(where);
  const lastDiag = r.records.map((x, i) => (x.kind === "diag" ? i : -1)).filter((i) => i >= 0);
  expect(lastDiag.at(-1), "E1164 comes after the step's own diagnostics").toBe(
    rec === undefined ? -2 : r.records.indexOf(rec),
  );
  expect(r.status, shown).toBe(1);
  expect(snapshot(lib), "nothing is written").toEqual(before);
}

describe("kind: the folder is no library", () => {
  const dir = (files: Record<string, string>): string => {
    const d = materialize(files);
    made.push(d);
    return d;
  };
  const plain = `${JSON.stringify({ name: "@acme/plain", version: "1.0.0" }, null, 2)}\n`;
  const cases: [string, Record<string, string>, string, Where][] = [
    ["no package.json", {}, "kind: no package.json here, so no library", "nowhere"],
    [
      "a package.json that is no JSON",
      { "package.json": "{ not json\n" },
      "kind: package.json is not JSON",
      { path: "package.json", line: 1 },
    ],
    [
      "a package.json with no keel field",
      { "package.json": plain },
      'kind: package.json has no "keel": "library"',
      { path: "package.json", line: 1 },
    ],
  ];
  for (const [what, files, message, where] of cases)
    for (const check of [false, true])
      test(
        `kind: \`keel pack${check ? " --check" : ""}\` in a folder with ${what} is one E1164, \`${message}\`, and writes no file`,
        () => {
          const d = dir(files);
          const before = snapshot(d);
          expectRefusal(d, before, pack(d, check), message, where);
        },
        SLOW,
      );

  test(
    'kind: a package.json whose `keel` is not "library" is `kind: package.json has no "keel": "library"` at the `keel` value',
    () => {
      const text = `${JSON.stringify({ name: "@acme/plain", version: "1.0.0", keel: "app" }, null, 2)}\n`;
      const d = dir({ "package.json": text });
      const before = snapshot(d);
      expectRefusal(d, before, pack(d), 'kind: package.json has no "keel": "library"', {
        path: "package.json",
        ...valueAt(text, "keel"),
      });
    },
    SLOW,
  );

  for (const name of ["charts", "acme/charts", "@acme", "@Acme/charts"])
    test(
      `kind: the name "${name}" is \`kind: name "${name}" is no scoped package name\` at the \`name\` value`,
      () => {
        const text = `${JSON.stringify({ name, version: "1.0.0", keel: "library" }, null, 2)}\n`;
        const d = dir({ "package.json": text });
        const before = snapshot(d);
        expectRefusal(d, before, pack(d), `kind: name "${name}" is no scoped package name`, {
          path: "package.json",
          ...valueAt(text, "name"),
        });
      },
      SLOW,
    );
});

type Defect = {
  readonly name: string;
  /** The clause of the `package` list the refusal belongs to: a lower group is reported before a higher one. */
  readonly group: number;
  readonly message: string;
  /** The `package.json` key the E1164 sits at (`keel` when there is no field to point at). */
  readonly at: string;
  readonly apply: (lib: string, pkg: Pkg) => Pkg;
};
const TYPES = "./dist/src/index.d.ts";
const DEFAULT = "./dist/src/index.js";
const FIVE = ["@keel/compiler", "@keel/reactive", "@keel/runtime-dom", "@keel/schema", "@keel/ui"];

const defects: Defect[] = [
  {
    name: "no root module.ts",
    group: 0,
    message: "package has no root module.ts, the library's manifest",
    at: "keel",
    apply: (lib, pkg) => {
      rmSync(join(lib, "module.ts"));
      return pkg;
    },
  },
  {
    name: 'an exports "." entry with no keel condition',
    group: 1,
    message: 'package exports "." lists no keel condition first',
    at: "exports",
    apply: (_l, pkg) => ({ ...pkg, exports: { ".": { types: TYPES, default: DEFAULT } } }),
  },
  {
    name: "an exports entry listing keel after another condition",
    group: 1,
    message: 'package exports "./extra" lists keel after another',
    at: "exports",
    apply: (_l, pkg) => ({
      ...pkg,
      exports: { ...objOf(pkg.exports), "./extra": { default: DEFAULT, keel: "./src/index.ts" } },
    }),
  },
  {
    name: "a keel target that is no file under src/ or unsafe/ (module.ts)",
    group: 1,
    message: 'package exports "." keel is no file under src/ or unsafe/',
    at: "exports",
    apply: (_l, pkg) => ({ ...pkg, exports: { ".": { keel: "./module.ts", types: TYPES, default: DEFAULT } } }),
  },
  {
    name: "no files",
    group: 2,
    message: "package lists no files, so a tarball would hold everything",
    at: "keel",
    apply: (_l, pkg) => without(pkg, "files"),
  },
  {
    name: "a files that omits module.ts",
    group: 3,
    message: "package files omits module.ts",
    at: "files",
    apply: (_l, pkg) => ({ ...pkg, files: listOf(pkg.files).filter((f) => f !== "module.ts") }),
  },
  {
    name: "a dependencies that lists @keel/ui",
    group: 4,
    message: "package dependencies lists @keel/ui; a peer resolves to the app's",
    at: "dependencies",
    apply: (_l, pkg) => ({ ...pkg, dependencies: { "@keel/ui": "^0.0.0" } }),
  },
  {
    name: "a peerDependencies that omits @keel/schema",
    group: 4,
    message: "package peerDependencies omits @keel/schema",
    at: "peerDependencies",
    apply: (_l, pkg) => ({ ...pkg, peerDependencies: without(objOf(pkg.peerDependencies), "@keel/schema") }),
  },
  {
    name: "a files that ships .env",
    group: 5,
    message: "package files ships .env, a secret's file",
    at: "files",
    apply: (lib, pkg) => {
      writeFileSync(join(lib, ".env"), "SECRET=1\n");
      return { ...pkg, files: [...listOf(pkg.files), ".env"] };
    },
  },
  {
    name: "a files that ships tokens.ts",
    group: 5,
    message: "package files ships tokens.ts; an app checks the library against its own",
    at: "files",
    apply: (_l, pkg) => ({ ...pkg, files: [...listOf(pkg.files), "tokens.ts"] }),
  },
];

/** A library with `list` applied, last first (an earlier defect's edit wins where two touch one field), its `package.json` written. */
function broken(list: Defect[]): { lib: string; text: string } {
  const lib = fresh();
  let pkg = readPkg(lib);
  for (const d of [...list].reverse()) pkg = d.apply(lib, pkg);
  return { lib, text: writePkg(lib, pkg) };
}

describe("package: a library an app could not read, check or trust does not pack", () => {
  for (const d of defects)
    for (const check of [false, true])
      test(
        `package: ${d.name} is one E1164 \`${d.message}\` at \`${d.at}\`, and \`keel pack${check ? " --check" : ""}\` writes no file`,
        () => {
          const { lib, text } = broken([d]);
          const before = snapshot(lib);
          expectRefusal(lib, before, pack(lib, check), d.message, { path: "package.json", ...valueAt(text, d.at) });
        },
        SLOW,
      );

  for (const target of [
    "../outside.ts",
    "./src/none.ts",
    "./src",
    "./src/index.js",
    "./dist/src/index.js",
    "./README.md",
  ])
    test(
      `package: a keel target \`${target}\`, no \`.ts\` or \`.tsx\` file under src/ or unsafe/ inside the package, is one E1164 \`package exports "." keel is no file under src/ or unsafe/\` at \`exports\``,
      () => {
        const lib = fresh();
        const text = writePkg(lib, {
          ...readPkg(lib),
          exports: { ".": { keel: target, types: TYPES, default: DEFAULT } },
        });
        const before = snapshot(lib);
        expectRefusal(lib, before, pack(lib), 'package exports "." keel is no file under src/ or unsafe/', {
          path: "package.json",
          ...valueAt(text, "exports"),
        });
      },
      SLOW,
    );

  test(
    "package: a files that omits `.keel/ledger.json` is one E1164 `package files omits .keel/ledger.json` at `files`",
    () => {
      const lib = fresh();
      const pkg = readPkg(lib);
      const text = writePkg(lib, { ...pkg, files: listOf(pkg.files).filter((f) => f !== ".keel/ledger.json") });
      const before = snapshot(lib);
      expectRefusal(lib, before, pack(lib), "package files omits .keel/ledger.json", {
        path: "package.json",
        ...valueAt(text, "files"),
      });
    },
    SLOW,
  );

  test(
    "package: a files that omits `src` is one E1164 `package files omits <path>`, `<path>` a file under `src/`, at `files`",
    () => {
      const lib = fresh();
      const pkg = readPkg(lib);
      const text = writePkg(lib, { ...pkg, files: listOf(pkg.files).filter((f) => f !== "src") });
      const before = snapshot(lib);
      expectRefusal(lib, before, pack(lib), /^package files omits src\/[^ ,]+$/, {
        path: "package.json",
        ...valueAt(text, "files"),
      });
    },
    SLOW,
  );

  test(
    "package: a library with an `unsafe/` folder whose files does not name `unsafe` is one E1164 `package files omits <path>`, `<path>` a file under `unsafe/`, at `files`; naming it, `keel pack` passes",
    () => {
      const lib = fresh();
      mkdirSync(join(lib, "unsafe"));
      writeFileSync(join(lib, "unsafe/raw.ts"), CLEAN_UNSAFE);
      const pkg = readPkg(lib);
      const text = writePkg(lib, pkg);
      const before = snapshot(lib);
      expectRefusal(lib, before, pack(lib), /^package files omits unsafe\/[^ ,]+$/, {
        path: "package.json",
        ...valueAt(text, "files"),
      });
      writePkg(lib, { ...pkg, files: [...listOf(pkg.files), "unsafe"] });
      const ok = pack(lib);
      expect(ok.status, JSON.stringify(ok.records).slice(0, 600)).toBe(0);
    },
    SLOW,
  );

  test(
    'package: a files that omits `dist`, which an `exports` target names, is one E1164 `package files omits <path>, exports "."` at `files`',
    () => {
      const lib = fresh();
      const pkg = readPkg(lib);
      const text = writePkg(lib, { ...pkg, files: listOf(pkg.files).filter((f) => f !== "dist") });
      const before = snapshot(lib);
      expectRefusal(lib, before, pack(lib), /^package files omits dist\/src\/index\.(d\.ts|js), exports "\."$/, {
        path: "package.json",
        ...valueAt(text, "files"),
      });
    },
    SLOW,
  );

  for (const name of FIVE)
    test(
      `package: a \`dependencies\` that lists ${name} is one E1164 \`package dependencies lists ${name}; a peer resolves to the app's\` at \`dependencies\``,
      () => {
        const lib = fresh();
        const text = writePkg(lib, { ...readPkg(lib), dependencies: { [name]: "^0.0.0" } });
        const before = snapshot(lib);
        expectRefusal(lib, before, pack(lib), `package dependencies lists ${name}; a peer resolves to the app's`, {
          path: "package.json",
          ...valueAt(text, "dependencies"),
        });
      },
      SLOW,
    );

  for (const name of FIVE)
    test(
      `package: a \`peerDependencies\` that omits ${name} is one E1164 \`package peerDependencies omits ${name}\` at \`peerDependencies\``,
      () => {
        const lib = fresh();
        const pkg = readPkg(lib);
        const text = writePkg(lib, { ...pkg, peerDependencies: without(objOf(pkg.peerDependencies), name) });
        const before = snapshot(lib);
        expectRefusal(lib, before, pack(lib), `package peerDependencies omits ${name}`, {
          path: "package.json",
          ...valueAt(text, "peerDependencies"),
        });
      },
      SLOW,
    );

  test(
    "package: a library with no `peerDependencies` is one E1164 `package peerDependencies omits <name>`, `<name>` a `@keel/*` package its files import, at `keel`",
    () => {
      const lib = fresh();
      const text = writePkg(lib, without(readPkg(lib), "peerDependencies"));
      const before = snapshot(lib);
      expectRefusal(
        lib,
        before,
        pack(lib),
        /^package peerDependencies omits @keel\/(compiler|reactive|runtime-dom|schema|ui)$/,
        {
          path: "package.json",
          ...valueAt(text, "keel"),
        },
      );
    },
    SLOW,
  );

  for (const secret of [".env", ".env.production", "src/.env"])
    test(
      `package: a tarball that would hold \`${secret}\` is one E1164 \`package files ships ${secret}, a secret's file\` at \`files\``,
      () => {
        const lib = fresh();
        writeFileSync(join(lib, secret), "SECRET=1\n");
        const pkg = readPkg(lib);
        const files = secret.startsWith("src/") ? listOf(pkg.files) : [...listOf(pkg.files), secret];
        const text = writePkg(lib, { ...pkg, files });
        const before = snapshot(lib);
        expectRefusal(lib, before, pack(lib), `package files ships ${secret}, a secret's file`, {
          path: "package.json",
          ...valueAt(text, "files"),
        });
      },
      SLOW,
    );

  test(
    "package: a `node_modules` folder is not judged: `keel pack` in a library holding one passes",
    () => {
      const lib = fresh();
      expect(existsSync(join(lib, "node_modules"))).toBe(true);
      const r = pack(lib);
      expect(r.status, JSON.stringify(r.records).slice(0, 600)).toBe(0);
    },
    SLOW,
  );

  test(
    "package: an `exports` key other than `.` that lists no `keel` condition is read at its other target: no E1164",
    () => {
      const lib = fresh();
      const pkg = readPkg(lib);
      writePkg(lib, { ...pkg, exports: { ...objOf(pkg.exports), "./extra": { default: DEFAULT } } });
      const r = pack(lib);
      expect(
        e1164(r).map((x) => x.message),
        JSON.stringify(r.records).slice(0, 600),
      ).toEqual([]);
    },
    SLOW,
  );

  test(
    "package: the first refusal in the order the spec gives is the one reported, whichever later ones the folder also holds (property over pairs from two clauses)",
    () => {
      const pairs = defects.flatMap((a, i) =>
        defects.flatMap((b, j): [number, number][] => (b.group > a.group && j > i ? [[i, j]] : [])),
      );
      fc.assert(
        fc.property(fc.constantFrom(...pairs), ([i, j]) => {
          const first = defects[i];
          const later = defects[j];
          if (first === undefined || later === undefined) throw new Error("pair out of range");
          const { lib, text } = broken([first, later]);
          const before = snapshot(lib);
          expectRefusal(lib, before, pack(lib), first.message, { path: "package.json", ...valueAt(text, first.at) });
        }),
        { seed: SEED, numRuns: 12 },
      );
    },
    SLOW,
  );
});

describe("check: the step's own diagnostics, then `check: <n> errors; nothing packed`", () => {
  test(
    "check: one error is `check: 1 error; nothing packed`, nowhere, after the E1805",
    () => {
      const lib = fresh();
      writeExample(lib, "<text />");
      const before = snapshot(lib);
      const r = pack(lib);
      expect(r.records.filter((x) => x.kind === "diag" && x.code === "E1805").length).toBe(1);
      expectRefusal(lib, before, r, "check: 1 error; nothing packed", "nowhere");
    },
    SLOW,
  );

  test(
    "check: n errors is `check: <n> errors; nothing packed`, n the errors the check reported, nowhere",
    () => {
      const lib = fresh();
      writeExample(lib, "<div><text /></div>");
      const before = snapshot(lib);
      const r = pack(lib);
      const n = r.records.filter(
        (x) => x.kind === "diag" && String(x.code).startsWith("E") && x.code !== "E1164",
      ).length;
      expect(n, JSON.stringify(r.records).slice(0, 600)).toBeGreaterThanOrEqual(2);
      expectRefusal(lib, before, r, `check: ${n} errors; nothing packed`, "nowhere");
    },
    SLOW,
  );
});

describe("test: the step's own diagnostics, then `test: <f> of <n> tests failed; nothing packed`", () => {
  const failing = (n: number): string =>
    `import { expect, it } from 'vitest'\n${Array.from({ length: n }, (_, i) => `it('fails ${i}', () => {\n  expect(1).toBe(2)\n})\n`).join("")}`;
  for (const f of [1, 2])
    test(
      `test: ${f} failing of ${f + 1} tests is \`test: ${f} of ${f + 1} tests failed; nothing packed\`, nowhere`,
      () => {
        const lib = fresh();
        writeFileSync(join(lib, "test/Fail.test.ts"), failing(f));
        const before = snapshot(lib);
        expectRefusal(lib, before, pack(lib), `test: ${f} of ${f + 1} tests failed; nothing packed`, "nowhere");
      },
      SLOW,
    );

  test(
    "test: a run that did not pass with no test failed (a test file that throws as it loads) is `test: the run did not pass; nothing packed`, nowhere",
    () => {
      const lib = fresh();
      writeFileSync(join(lib, "test/Boom.test.ts"), "throw new Error('does not load')\n");
      const before = snapshot(lib);
      expectRefusal(lib, before, pack(lib), "test: the run did not pass; nothing packed", "nowhere");
    },
    SLOW,
  );
});

describe("ledger: when the file cannot be written, and under --check", () => {
  test(
    "ledger: a `.keel` that is not a folder is `ledger: .keel is not a folder` at `.keel`",
    () => {
      const lib = fresh();
      writeFileSync(join(lib, ".keel"), "not a folder\n");
      const before = snapshot(lib);
      expectRefusal(lib, before, pack(lib), "ledger: .keel is not a folder", { path: ".keel" });
    },
    SLOW,
  );

  test(
    "ledger: a `.keel` folder `.keel/ledger.json` cannot be written in is `ledger: .keel/ledger.json cannot be written here` at `.keel/ledger.json`",
    () => {
      const lib = fresh();
      mkdirSync(join(lib, ".keel"));
      chmodSync(join(lib, ".keel"), 0o555);
      try {
        const before = snapshot(lib);
        expectRefusal(lib, before, pack(lib), "ledger: .keel/ledger.json cannot be written here", {
          path: ".keel/ledger.json",
        });
      } finally {
        chmodSync(join(lib, ".keel"), 0o755);
      }
    },
    SLOW,
  );

  test(
    "ledger: under `--check` a missing `.keel/ledger.json` is `ledger: .keel/ledger.json is missing; keel pack writes it`, nowhere",
    () => {
      const lib = fresh();
      const before = snapshot(lib);
      expectRefusal(
        lib,
        before,
        pack(lib, true),
        "ledger: .keel/ledger.json is missing; keel pack writes it",
        "nowhere",
      );
    },
    SLOW,
  );

  const misshapen: [string, string][] = [
    ["an empty object", "{}\n"],
    ["text that is not JSON", "not json\n"],
    ["an array", "[]\n"],
    ["a wrong `version`", `${JSON.stringify({ version: 2, unsafe: 0, hostElements: 0, exports: [] })}\n`],
    ["a negative `hostElements`", `${JSON.stringify({ version: 1, unsafe: 0, hostElements: -1, exports: [] })}\n`],
  ];
  for (const [what, text] of misshapen)
    test(
      `ledger: under \`--check\` a shipped file that is ${what} fails its shape: \`ledger: .keel/ledger.json fails its shape; keel pack writes it again\` at the file, line 1`,
      () => {
        const lib = packedCopy();
        writeFileSync(join(lib, ".keel/ledger.json"), text);
        const before = snapshot(lib);
        expectRefusal(
          lib,
          before,
          pack(lib, true),
          "ledger: .keel/ledger.json fails its shape; keel pack writes it again",
          {
            path: ".keel/ledger.json",
            line: 1,
          },
        );
      },
      SLOW,
    );

  const stale: [string, Record<string, unknown>, string][] = [
    ["unsafe", { unsafe: 1 }, "unsafe"],
    ["hostElements", { hostElements: 1 }, "hostElements"],
    ["exports", { exports: [] }, "exports"],
    ["unsafe and hostElements, the first of them", { unsafe: 1, hostElements: 1 }, "unsafe"],
    ["hostElements and exports, the first of them", { hostElements: 1, exports: [] }, "hostElements"],
  ];
  for (const [what, over, field] of stale)
    test(
      `ledger: under \`--check\` a shipped file that differs at ${what} is \`ledger: .keel/ledger.json is stale at ${field}; keel pack writes it again\` at the file, line 1`,
      () => {
        const lib = packedCopy();
        const j = readJson(lib, ".keel/ledger.json");
        writeFileSync(join(lib, ".keel/ledger.json"), `${JSON.stringify({ ...objOf(j), ...over }, null, 2)}\n`);
        const before = snapshot(lib);
        expectRefusal(
          lib,
          before,
          pack(lib, true),
          `ledger: .keel/ledger.json is stale at ${field}; keel pack writes it again`,
          {
            path: ".keel/ledger.json",
            line: 1,
          },
        );
      },
      SLOW,
    );

  test(
    "ledger: a source file edited after `keel pack` (a `Host` added to `src/Example.tsx`) makes `keel pack --check` stale at `hostElements`",
    () => {
      const lib = packedCopy();
      exampleWithHost(lib, 1);
      const before = snapshot(lib);
      expectRefusal(
        lib,
        before,
        pack(lib, true),
        "ledger: .keel/ledger.json is stale at hostElements; keel pack writes it again",
        {
          path: ".keel/ledger.json",
          line: 1,
        },
      );
    },
    SLOW,
  );

  test(
    "Pack: `keel pack --check` changes nothing in the folder but under `node_modules/`: a passing run and a refused one leave every file byte for byte",
    () => {
      const lib = packedCopy();
      const before = snapshot(lib);
      const ok = pack(lib, true);
      expect(ok.status, JSON.stringify(ok.records).slice(0, 600)).toBe(0);
      expect(snapshot(lib)).toEqual(before);
      expect(readText(lib, ".keel/ledger.json")).toBe(before[".keel/ledger.json"]);
      writeExample(lib, "<text />");
      const edited = snapshot(lib);
      expect(pack(lib, true).status).toBe(1);
      expect(snapshot(lib)).toEqual(edited);
    },
    SLOW,
  );
});
