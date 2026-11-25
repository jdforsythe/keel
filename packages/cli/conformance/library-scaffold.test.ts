// Spec: k.library-pack, Package: "A library (k.library) publishes, as its `package.json` `files`: `module.ts`, `src/`, `unsafe/` when it has one, `dist/` (its `tsc` build, which Node imports), `.keel/ledger.json` and its `README.md`. Each `exports` key maps `keel` to the source file, then `types` and `default` to the built files; `publishConfig.exports`, where a package has one, keeps `keel` at the source path. The `@keel/*` packages it imports are `peerDependencies`. Its root `tokens.ts` is not published: an app checks the library against its own."
// Spec: k.library-pack, Scaffold: "`keel scaffold library <name>`, `<name>` a scoped package name `@<scope>/<base>` of lowercase letters, digits and `-`, writes folder `<base>/` in the working directory, holding:"
// Spec: k.library-pack, Rules: "E1164 `keel pack`: the step it names failed (`check`, `test`, `ledger`), or the folder is no library (`kind`); nothing is written."
// Conformance 2. "`keel scaffold library charts` and `keel scaffold library @acme/Charts` are each one E1352 and write nothing; run twice with `@acme/charts`, the second run is one E1351 and writes nothing."
// Seed: 1337 (the two properties over names; every other case is an example). Binary runs: 1 scaffold shared by the read-only cases, then per case: tsc 2 (the build case, the link case), `keel check` 2 + 1,
// `keel test` 1, `keel pack` 1 and `keel pack --check` 3, `keel scaffold project` 1, `--dry-run` 1, no name 1, the refusals 2 + 8 (property) + 2 + 1, the valid-name property 6, `keel build` 1, `keel ledger` 1.
// ASSUMPTIONS (spec silent, readings asserted):
//  - The Scaffold list is the whole of what is written, but `README.md` (the Package `files` names it, the list does not write it).
//  - "at the running `@keel/cli`'s version": each of the four `@keel/*` entries holds the `version` of `packages/cli/package.json` (as itself or in a range) and the four hold one string.
//  - "lowerCamel": a base of `-`-joined segments, each a letter then letters and digits, gives its first segment then each other with its first letter in upper case; a base the spec leaves open (a segment of digits first, a `-` at either end) is not generated.
//  - "`<name>` of another form": no scope, no base, empty scope, an uppercase letter, `_ . ! ~ $` or a space in scope or base, a second `/`.
//  - "as written ... `keel pack --check`": the spec writes no `.keel/ledger.json` in the folder and says `keel pack --check` is E1164 naming `ledger` when it is missing, so the case asserts that, then `keel pack` and a passing `--check`.
//  - The app of the link case lists the library (built with `tsc -p tsconfig.build.json`, as `scripts.build`) by a symbolic link from `node_modules/@acme/keel-charts` to the scaffolded folder; whether an unbuilt library builds in an app is not stated.
//  - `keel scaffold library` with no name: k.cli says a failing input schema is E1052; asserted as at least one E1052, exit not 0, nothing written.
// by-code table: E1351 and E1352 are the scaffold package's codes (`check()` does not report them); they have no row in packages/check/conformance/fixtures-by-code.ts.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";
import {
  LIB_BASE,
  LIB_ID,
  LIB_NAME,
  REPO,
  SLOW,
  cleanup,
  cloneLibrary,
  diags,
  isRecord,
  keel,
  materialize,
  namesOnly,
  pack,
  readJson,
  readText,
  roundTripApp,
  scaffoldLibrary,
  scaffolded,
  scratch,
  snapshot,
  writeLedger,
} from "./library-support.ts";

const SEED = 1337;
const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});
const tmp = (): string => {
  const d = scratch();
  made.push(d);
  return d;
};

let base: ReturnType<typeof scaffolded> | undefined;
/** The scaffolded library (`@acme/keel-charts`) every read-only case reads: one binary run for the file. */
function lib(): ReturnType<typeof scaffolded> {
  if (base === undefined) {
    base = scaffolded();
    made.push(base.scratchDir);
  }
  return base;
}
const fresh = (): string => cloneLibrary(lib().lib);

const FILES = [
  "package.json",
  "module.ts",
  "src/index.ts",
  "src/Example.tsx",
  "test/Example.test.ts",
  "tokens.ts",
  "tsconfig.json",
  "tsconfig.build.json",
  "vitest.config.ts",
];
const PACKAGE_FILES = ["module.ts", "src", "dist", ".keel/ledger.json", "README.md"];

const pkgOf = (dir: string): Record<string, unknown> => {
  const j = readJson(dir, "package.json");
  return isRecord(j) ? j : {};
};
const keysOf = (v: unknown): string[] => (isRecord(v) ? Object.keys(v) : []);

const seg = fc.stringMatching(/^[a-z][a-z0-9]{0,4}$/);
const camel = (segs: string[]): string =>
  segs.map((s, i) => (i === 0 ? s : `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`)).join("");

describe("Scaffold: keel scaffold library <name>", () => {
  test(
    '`keel scaffold library @acme/keel-charts` writes `keel-charts/` whose `package.json` has `"keel": "library"` and whose `module.ts` has `id: \'keelCharts\'`',
    () => {
      const { run, lib: dir } = lib();
      expect(run.status, JSON.stringify(run.records).slice(0, 600)).toBe(0);
      expect(pkgOf(dir).keel).toBe("library");
      expect(readText(dir, "module.ts")).toMatch(new RegExp(`id:\\s*'${LIB_ID}'`));
    },
    SLOW,
  );

  test(
    "Scaffold: it writes folder `<base>/` in the working directory, holding `package.json`, `module.ts`, `src/index.ts`, `src/Example.tsx`, `test/Example.test.ts`, `tokens.ts`, `tsconfig.json`, `tsconfig.build.json` and `vitest.config.ts`, and nothing outside it",
    () => {
      const { scratchDir, lib: dir } = lib();
      expect(Object.keys(snapshot(scratchDir))).toEqual(expect.arrayContaining([LIB_BASE]));
      expect(Object.keys(snapshot(scratchDir)).filter((p) => !p.startsWith(`${LIB_BASE}/`))).toEqual([LIB_BASE]);
      const written = Object.entries(snapshot(dir))
        .filter(([, v]) => v !== "dir")
        .map(([p]) => p);
      for (const f of FILES) expect(written, f).toContain(f);
      // README.md is the one file beyond the list the Package sentence allows (it names it in `files`).
      expect(written.filter((p) => !FILES.includes(p) && p !== "README.md")).toEqual([]);
    },
    SLOW,
  );

  test(
    'Scaffold: `package.json` holds `name`, `version` `0.1.0`, `"type": "module"` and `"keel": "library"`',
    () => {
      const pkg = pkgOf(lib().lib);
      expect(pkg.name).toBe(LIB_NAME);
      expect(pkg.version).toBe("0.1.0");
      expect(pkg.type).toBe("module");
      expect(pkg.keel).toBe("library");
    },
    SLOW,
  );

  test(
    'Scaffold: `exports` is `{ ".": { "keel": "./src/index.ts", "types": "./dist/src/index.d.ts", "default": "./dist/src/index.js" } }`, `keel` first',
    () => {
      const pkg = pkgOf(lib().lib);
      expect(pkg.exports).toEqual({
        ".": { keel: "./src/index.ts", types: "./dist/src/index.d.ts", default: "./dist/src/index.js" },
      });
      const dot = isRecord(pkg.exports) ? pkg.exports["."] : undefined;
      expect(keysOf(dot)).toEqual(["keel", "types", "default"]);
    },
    SLOW,
  );

  test(
    "Package: the scaffolded `files` hold `module.ts`, `src/`, `dist/`, `.keel/ledger.json` and `README.md` (`unsafe/` only when it has one)",
    () => {
      const files = Array.isArray(pkgOf(lib().lib).files) ? pkgOf(lib().lib).files : [];
      const norm = (Array.isArray(files) ? files : []).map((f) => String(f).replace(/\/$/, "")).sort();
      for (const f of PACKAGE_FILES) expect(norm, f).toContain(f);
      expect(norm.filter((f) => !PACKAGE_FILES.includes(f) && f !== "unsafe")).toEqual([]);
    },
    SLOW,
  );

  test(
    "Scaffold: `scripts` is `{ build: tsc -p tsconfig.build.json, check: keel check, test: keel test, prepack: tsc -p tsconfig.build.json && keel pack --check }`",
    () => {
      expect(pkgOf(lib().lib).scripts).toEqual({
        build: "tsc -p tsconfig.build.json",
        check: "keel check",
        test: "keel test",
        prepack: "tsc -p tsconfig.build.json && keel pack --check",
      });
    },
    SLOW,
  );

  test(
    "Scaffold: `peerDependencies` are `@keel/ui` and `@keel/compiler` at the running `@keel/cli`'s version, with `@keel/cli` and `@keel/testing` beside them in `devDependencies`",
    () => {
      const pkg = pkgOf(lib().lib);
      const cli = readJson(join(REPO, "packages/cli"), "package.json");
      const version = isRecord(cli) ? String(cli.version) : "";
      expect(version).not.toBe("");
      expect(keysOf(pkg.peerDependencies).sort()).toEqual(["@keel/compiler", "@keel/ui"]);
      expect(keysOf(pkg.devDependencies)).toEqual(expect.arrayContaining(["@keel/cli", "@keel/testing"]));
      const peers = isRecord(pkg.peerDependencies) ? pkg.peerDependencies : {};
      const dev = isRecord(pkg.devDependencies) ? pkg.devDependencies : {};
      const all = [peers["@keel/ui"], peers["@keel/compiler"], dev["@keel/cli"], dev["@keel/testing"]].map(String);
      for (const v of all) expect(v).toContain(version);
      expect(new Set(all).size).toBe(1);
    },
    SLOW,
  );

  test(
    "Scaffold: `module.ts` has `id` the base in lowerCamel, `deps: []`, `capabilities: []`, `public: { exports: ['Example'] }`",
    () => {
      const text = readText(lib().lib, "module.ts");
      expect(text).toMatch(/deps:\s*\[\s*\]/);
      expect(text).toMatch(/capabilities:\s*\[\s*\]/);
      expect(text).toMatch(/public:\s*\{\s*exports:\s*\[\s*'Example'\s*\]\s*\}/);
    },
    SLOW,
  );

  test(
    "Scaffold: for a generated base `<a>-<b>-<c>`, `module.ts` has `id` its lowerCamel form and the folder is `<base>/`",
    () => {
      const dir = tmp();
      fc.assert(
        fc.property(fc.array(seg, { minLength: 1, maxLength: 3 }), (segs) => {
          const name = `@acme/${segs.join("-")}`;
          const r = scaffoldLibrary(dir, name);
          expect(r.status, name).toBe(0);
          const folder = join(dir, segs.join("-"));
          expect(readText(folder, "module.ts")).toMatch(new RegExp(`id:\\s*'${camel(segs)}'`));
          expect(pkgOf(folder).name).toBe(name);
          rmSync(folder, { recursive: true, force: true });
        }),
        { seed: SEED, numRuns: 6 },
      );
    },
    SLOW,
  );

  test(
    "Scaffold: `src/index.ts` re-exports `Example`; `src/Example.tsx` is a component whose props are `{ id: string }` and which renders one `Text` with id `${props.id}.text`; `test/Example.test.ts` renders it and finds `<id>.text`",
    () => {
      const dir = lib().lib;
      expect(readText(dir, "src/index.ts")).toMatch(/export[^\n]*Example/);
      const example = readText(dir, "src/Example.tsx");
      expect(example).toMatch(/id:\s*string/);
      expect(example).toContain("`${props.id}.text`");
      expect(example.match(/<Text\b/g)?.length).toBe(1);
      const test = readText(dir, "test/Example.test.ts");
      expect(test).toContain("render");
      expect(test).toContain(".text");
    },
    SLOW,
  );

  test(
    "Scaffold: `tokens.ts` is the file `keel scaffold project` writes",
    () => {
      const other = tmp();
      const r = keel(other, ["scaffold", "project", "shop"]);
      expect(r.status).toBe(0);
      expect(readText(lib().lib, "tokens.ts")).toBe(readText(join(other, "shop"), "tokens.ts"));
    },
    SLOW,
  );

  test(
    "Scaffold: `tsconfig.json`, `tsconfig.build.json` and `vitest.config.ts` are written, and `tsc -p tsconfig.build.json` builds `dist/src/index.js` and `dist/src/index.d.ts`",
    () => {
      const dir = fresh();
      for (const f of ["tsconfig.json", "tsconfig.build.json", "vitest.config.ts"])
        expect(readText(dir, f).length, f).toBeGreaterThan(0);
      const r = spawnSync(
        process.execPath,
        [join(REPO, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.build.json"],
        { cwd: dir, encoding: "utf8" },
      );
      expect(`${r.stdout}${r.stderr}`.slice(0, 600)).toBe("");
      expect(r.status).toBe(0);
      expect(existsSync(join(dir, "dist/src/index.js"))).toBe(true);
      expect(existsSync(join(dir, "dist/src/index.d.ts"))).toBe(true);
    },
    SLOW,
  );

  test(
    "Scaffold: the scaffolded library passes `keel check` and `keel test` as written",
    () => {
      const dir = fresh();
      const c = keel(dir, ["check"]);
      expect(
        c.records.filter((x) => x.kind === "diag"),
        JSON.stringify(c.records).slice(0, 600),
      ).toEqual([]);
      expect(c.status).toBe(0);
      const t = keel(dir, ["test"]);
      expect(t.records.find((x) => x.kind === "summary")?.ok, JSON.stringify(t.records).slice(0, 600)).toBe(true);
      expect(t.status).toBe(0);
    },
    SLOW,
  );

  test(
    "Scaffold: as written the library holds no `.keel/ledger.json`, so `keel pack --check` is one E1164 naming `ledger` until `keel pack` has written it",
    () => {
      const dir = fresh();
      expect(existsSync(join(dir, ".keel/ledger.json"))).toBe(false);
      expect(namesOnly(pack(dir, true), "ledger")).toBe(true);
      const w = pack(dir);
      expect(w.status, JSON.stringify(w.records).slice(0, 600)).toBe(0);
      expect(pack(dir, true).status).toBe(0);
    },
    SLOW,
  );

  test(
    "Scaffold (k.scaffold Operations): `--dry-run` writes nothing and exits 0",
    () => {
      const dir = tmp();
      const r = scaffoldLibrary(dir, "@acme/keel-charts", ["--dry-run"]);
      expect(r.status).toBe(0);
      expect(snapshot(dir)).toEqual({});
    },
    SLOW,
  );

  test(
    "Scaffold (k.cli E1052): `keel scaffold library` with no name is E1052 and writes nothing",
    () => {
      const dir = tmp();
      expect(scaffoldLibrary(dir, "@acme/other").status).toBe(0);
      const before = snapshot(dir);
      const r = keel(dir, ["scaffold", "library"]);
      expect(diags(r, "E1052").length).toBeGreaterThan(0);
      expect(r.status).not.toBe(0);
      expect(snapshot(dir)).toEqual(before);
    },
    SLOW,
  );
});

describe("Conformance 2: refused names", () => {
  test(
    "`keel scaffold library charts` and `keel scaffold library @acme/Charts` are each one E1352 and write nothing",
    () => {
      const dir = tmp();
      for (const name of ["charts", "@acme/Charts"]) {
        const r = scaffoldLibrary(dir, name);
        expect(diags(r, "E1352").length, name).toBe(1);
        expect(r.status, name).toBe(1);
        expect(snapshot(dir), name).toEqual({});
      }
    },
    SLOW,
  );

  const invalid = fc.oneof(
    seg,
    seg.map((s) => `@${s}`),
    seg.map((s) => `@${s}/`),
    seg.map((s) => `@/${s}`),
    fc
      .tuple(seg, seg, fc.constantFrom("A", "Z", "_", ".", "!", " ", "~", "$"))
      .map(([a, b, c]) => `@${a}/${b}${c}${b}`),
    fc.tuple(seg, seg).map(([a, b]) => `@${a}/${b}/${a}`),
    fc.tuple(fc.constantFrom("A", "Q"), seg).map(([u, a]) => `@${u}${a}/x`),
  );
  test(
    "Scaffold: a `<name>` that is not `@<scope>/<base>` of lowercase letters, digits and `-` is one E1352 and writes nothing",
    () => {
      const dir = tmp();
      fc.assert(
        fc.property(invalid, (name) => {
          const r = scaffoldLibrary(dir, name);
          expect(diags(r, "E1352").length, name).toBe(1);
          expect(snapshot(dir), name).toEqual({});
        }),
        { seed: SEED, numRuns: 8 },
      );
    },
    SLOW,
  );

  test(
    "run twice with `@acme/charts`, the second run is one E1351 and writes nothing",
    () => {
      const dir = tmp();
      expect(scaffoldLibrary(dir, "@acme/charts").status).toBe(0);
      const before = snapshot(dir);
      const again = scaffoldLibrary(dir, "@acme/charts");
      expect(diags(again, "E1351").length).toBe(1);
      expect(again.status).toBe(1);
      expect(snapshot(dir)).toEqual(before);
    },
    SLOW,
  );

  test(
    "Scaffold: an existing `<base>/` is E1351 whatever it holds and whatever the scope, and writes nothing",
    () => {
      const dir = tmp();
      mkdirSync(join(dir, "charts"));
      writeFileSync(join(dir, "charts/keep.txt"), "mine\n");
      const before = snapshot(dir);
      const r = scaffoldLibrary(dir, "@other/charts");
      expect(diags(r, "E1351").length).toBe(1);
      expect(snapshot(dir)).toEqual(before);
    },
    SLOW,
  );
});

describe("An app listing the scaffolded library through a workspace link builds", () => {
  let app: string | undefined;
  const linked = (): string => {
    if (app === undefined) {
      const dir = fresh();
      const tsc = spawnSync(
        process.execPath,
        [join(REPO, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.build.json"],
        { cwd: dir, encoding: "utf8" },
      );
      expect(tsc.status, `${tsc.stdout}${tsc.stderr}`.slice(0, 600)).toBe(0);
      const a = materialize(roundTripApp());
      made.push(a);
      mkdirSync(join(a, "node_modules/@acme"), { recursive: true });
      symlinkSync(dir, join(a, "node_modules", LIB_NAME));
      app = a;
    }
    return app;
  };

  test(
    "`keel check` in an app whose `node_modules/@acme/keel-charts` links to the built scaffolded library reports no diagnostic",
    () => {
      const r = keel(linked(), ["check"]);
      expect(
        r.records.filter((x) => x.kind === "diag"),
        JSON.stringify(r.records).slice(0, 800),
      ).toEqual([]);
      expect(r.status).toBe(0);
    },
    SLOW,
  );

  test(
    "`keel build` of that app exits 0 and `dist/site/index.html` holds the library's element `shop.example.text`",
    () => {
      const dir = linked();
      const r = keel(dir, ["build"]);
      expect(r.status, JSON.stringify(r.records).slice(0, 800)).toBe(0);
      expect(readFileSync(join(dir, "dist/site/index.html"), "utf8")).toContain('id="shop.example.text"');
    },
    SLOW,
  );

  test(
    "`keel ledger` of that app lists the linked library under `libraries` with its version and the app's counts, and no E1162",
    () => {
      const w = writeLedger(linked(), "out.json");
      expect(diags(w.run, "E1162")).toEqual([]);
      const j = isRecord(w.json) ? w.json : {};
      expect(isRecord(j.libraries) ? j.libraries[LIB_NAME] : undefined).toEqual({
        version: "0.1.0",
        unsafe: 0,
        hostElements: 0,
      });
    },
    SLOW,
  );
});
