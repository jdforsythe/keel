// Spec: k.library-pack, Package: "A library (k.library) publishes, as its `package.json` `files`: `module.ts`, `src/`, `unsafe/` when it has one, `dist/` (its `tsc` build: declarations, and the `./tools` file Node imports), `.keel/ledger.json` and its `README.md`. Each `exports` key maps `keel` to the source file, then `types` and `default` to the built files; `publishConfig.exports`, where a package has one, keeps `keel` at the source path. The `@keel/*` packages its files import, and `@keel/reactive` and `@keel/runtime-dom`, which the compiler's output of its JSX imports, are `peerDependencies` and never `dependencies`, so each resolves to the app's copy. Its root `tokens.ts` is not published: an app checks the library against its own."
// Spec: k.library-pack, Own folder: "In a folder whose `package.json` has `"keel": "library"` and a scoped name, `keel check`, `keel test` and `keel ledger` read the root `module.ts` as the manifest of the folder's one module, `src/` and `unsafe/` as that module's code, `test/` and co-located tests as its tests, and the root `tokens.ts` as its tokens. `keel check` reads the folder as an app holds the library installed: every k.library rule holds there, each diagnostic at the folder's own path, and the libraries its manifest lists are read and imported as an app's are; E1162 does not, since the folder is no app's install."
// Spec: k.library-pack, Own folder: "`keel test` there writes no `.keel/` artifact and no `reports/a11y.json`. Its ledger file counts `unsafe` and `hostElements` over the files under `src/` and `unsafe/`, as an app counts them (k.library Ledger); its `exports` are every export of a `src/` file but tests, `Props` and `uses`, `pkg` the manifest's `id` and `file` the file's path, with rungs from its tests; its `libraries` is `{}`."
// Spec: k.library-pack, Pack: "`keel pack`, run in a library's folder, runs five steps: `kind`, `package`, `check` (`keel check`), `test` (`keel test`) and `ledger` (`keel ledger --write .keel/ledger.json`). It stops at the first step that fails, reports that step's own diagnostics and then one E1164 whose message begins with the step's name, and writes no file. On success it prints one summary record (`docs/OUTPUT.md`) whose `counts` are `{ unsafe, hostElements, exports }` of the ledger it wrote, `exports` the number of its entries, and writes `.keel/ledger.json` alone."
// Spec: k.library-pack, Pack: "`keel pack --check` runs the same steps and writes nothing; its `ledger` step is E1164 when `.keel/ledger.json` is missing, fails its shape as an app reads it (Ledger file), or holds an `unsafe`, `hostElements` or `exports` other than the ones `keel pack` would write; other keys are not judged. Writing nothing, it changes nothing in the folder but under `node_modules/`, where the type cache lives (k.check-cache). A tarball is made by the package manager, whose `prepack` runs `keel pack --check`; it holds what `files` selects and what the package manager always packs (`package.json`, `README`, `LICENSE`), never a `node_modules` folder, and `keel pack` reads that list."
// Spec: k.library-pack, Rules: "E1164 `keel pack`: the step its message begins with failed (`kind`, `package`, `check`, `test`, `ledger`; Pack); nothing is written."
// Spec: k.library-pack, Conformance 1: "`keel scaffold library @acme/keel-charts` writes `keel-charts/` whose `package.json` has `"keel": "library"` and whose `module.ts` has `id: 'keelCharts'`; with its dependencies installed, `keel pack` there exits 0 and writes `.keel/ledger.json` with `unsafe` 0 and `hostElements` 0, after which `keel pack --check` exits 0."
// Spec: k.library-pack, Conformance 3: "In that scaffolded library, a test made to fail makes `keel pack` report one E1164 whose message names `test`, and no `.keel/ledger.json` is written; `<text />` in `src/Example.tsx` makes it report one E1805 and one E1164 naming `check`."
// Spec: k.library-pack, Conformance 4: "In that scaffolded library, after `keel pack`, adding `Host` to `src/Example.tsx` makes `keel pack --check` report one E1164 naming `ledger` and leaves `.keel/ledger.json` unchanged; `keel pack` then writes `hostElements` 1."
// Spec: k.library-pack, Conformance 5: "`keel pack` in a folder whose `package.json` has no `keel` field is one E1164 naming `kind`."
// Spec: k.library, Ledger (the app's `keel ledger` over an installed library): "Per entry of an installed library's ledger `exports` (libraries by name, entries in file order), `keel ledger` emits `{ kind: 'ledger', item: '<name>/<file>#<export>', rung, evidence: 'library <version>' }` after the project's records, `<version>` its `package.json` `version`; `--scope` keeps one whose item starts with it. None of it is the app's: the summary `counts`, the written `exports` and `rungs`, and `--diff` leave it out; a file E1162 fails adds none."
// Spec: k.library-pack, Ledger file (E1162 from `keel check` alone): "E1162 (k.library), from `keel check` alone (`keel ledger` takes a failing file as none: its items are not shown, its counts recounted), has five messages, each whole within 89 units for a name of up to 38 units and counts of up to six digits: `<name> ships no .keel/ledger.json` (the name and 27 units: 65); `<name> .keel/ledger.json is over 262144 bytes` (39: 77), the file read no further; `<name> .keel/ledger.json is not a JSON object` (39: 77) for an empty file, text that is not JSON, or JSON other than an object (an array, `null`, a number, a string, a boolean); `<name> .keel/ledger.json fails its shape at <key>` (38 and the key, at most 12: 88), `<key>` the first of `version`, `unsafe`, `hostElements` and `exports` missing or holding a wrong value (an `exports` entry with a field missing or of another type is a wrong value); else `<name> ships <field> <shipped>, its files hold <counted>` (25, the field, at most 12, and both counts' digits: 87 at `hostElements` with a shipped 999999 and a counted 100000 to 999999; a longer count lengthens it), one per field that differs, `unsafe` at the entry's opening quote and `hostElements` a column after it, so `unsafe` sorts first."
// Seed: 1337 (no generated input: every case is one scaffolded library and the real `keel` binary; the properties over names are in library-scaffold.test.ts). Binary runs, one folder shared:
// the scaffold (1) and `keel pack` then `keel pack --check` (2, shared by the Conformance 1, Pack and round-trip cases); each case below copies the scaffolded folder and runs the commands it names,
// `keel pack` or `keel pack --check` (each runs `keel check`, `keel test`, `keel ledger` inside) 1 to 2 times, `pnpm pack` (prepack: `tsc` then `keel pack --check`) 1 to 2 times (the round trip shares one tarball for its two apps), `keel check`/`keel build`/`keel ledger` in an app 1 each, shared by the cases that only read their output;
// the refusals are in library-pack-refusals.test.ts, the repeatability in library-pack-repeat.test.ts, the no-entry rule in library-no-entry.test.ts.
// ASSUMPTIONS (spec silent, readings asserted):
//  - "writes no file" is read as the folder, but its `node_modules`, byte for byte as before the run (a failing `keel pack` and `keel pack --check` both).
//  - The tarball is made by `pnpm pack` with `keel` and `tsc` on the path (shims in the scratch `node_modules/.bin`); the app installs it in pnpm's isolated layout: the files in a store folder inside `node_modules`, `@keel` linked beside them, the package linked.
//  - A tarball "made with its scripts off" is `pnpm pack --config.ignore-scripts=true`: the public command has no flag of its own.
//  - `keel ledger --write` prints a summary record (k.ledger File: "The summary `counts` carry `rungs`, `stale` and `keptNoReport`") and the spec names no other record it prints; what `rungs` is as a key of `counts` is not stated, so only the one summary is asserted. The app's per-export `ledger` records are read from plain `keel ledger` (k.library Ledger: "`keel ledger` emits ...").
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import type { Run } from "./compat-support.ts";
import {
  CLEAN_UNSAFE,
  LIB_ID,
  LIB_NAME,
  SLOW,
  appWithTarball,
  cleanup,
  cloneLibrary,
  diags,
  editTarball,
  exampleWithHost,
  hostFiles,
  isRecord,
  keel,
  materialize,
  namesOnly,
  pack,
  packTarball,
  readJson,
  readText,
  scaffolded,
  snapshot,
  tarEntries,
  unsafeSrc,
  writeExample,
  writeLedger,
} from "./library-support.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});

/** The scaffolded library every case copies (never edited), made once. */
let base: ReturnType<typeof scaffolded> | undefined;
function pristine(): ReturnType<typeof scaffolded> {
  if (base === undefined) {
    base = scaffolded();
    made.push(base.scratchDir);
  }
  return base;
}
const fresh = (): string => cloneLibrary(pristine().lib);

/** The library after `keel pack` (and `keel pack --check`): made once, its two runs and the folder around the second kept. */
type Flow = {
  lib: string;
  pack: Run;
  check: Run;
  beforeCheck: Record<string, string>;
  afterCheck: Record<string, string>;
};
let flow: Flow | undefined;
function packed(): Flow {
  if (flow === undefined) {
    const lib = fresh();
    const first = pack(lib);
    const beforeCheck = snapshot(lib);
    const check = pack(lib, true);
    flow = { lib, pack: first, check, beforeCheck, afterCheck: snapshot(lib) };
  }
  return flow;
}
/** A copy of the packed library, ledger included. */
const packedCopy = (): string => cloneLibrary(packed().lib);

const ledgerIn = (lib: string): Record<string, unknown> => {
  const j = readJson(lib, ".keel/ledger.json");
  return isRecord(j) ? j : {};
};

describe("Conformance 1: scaffold, pack, pack --check", () => {
  test(
    '`keel scaffold library @acme/keel-charts` writes `keel-charts/` whose `package.json` has `"keel": "library"` and whose `module.ts` has `id: \'keelCharts\'`; with its dependencies installed, `keel pack` there exits 0 and writes `.keel/ledger.json` with `unsafe` 0 and `hostElements` 0, after which `keel pack --check` exits 0.',
    () => {
      const { lib, run } = pristine();
      expect(run.status).toBe(0);
      const pkg = readJson(lib, "package.json");
      expect(isRecord(pkg) && pkg.keel).toBe("library");
      expect(readText(lib, "module.ts")).toMatch(new RegExp(`id:\\s*['"]${LIB_ID}['"]`));
      const f = packed();
      expect(f.pack.status, JSON.stringify(f.pack.records).slice(0, 800)).toBe(0);
      const ledger = ledgerIn(f.lib);
      expect(ledger.unsafe).toBe(0);
      expect(ledger.hostElements).toBe(0);
      expect(f.check.status, JSON.stringify(f.check.records).slice(0, 800)).toBe(0);
    },
    SLOW,
  );

  test(
    "Pack: on success `keel pack` prints one summary record whose `counts` are `{ unsafe, hostElements, exports }` of the ledger it wrote",
    () => {
      const f = packed();
      const summaries = f.pack.records.filter((r) => r.kind === "summary");
      expect(summaries.length).toBe(1);
      const ledger = ledgerIn(f.lib);
      const exports = Array.isArray(ledger.exports) ? ledger.exports : [];
      expect(summaries[0]?.counts).toEqual({
        unsafe: ledger.unsafe,
        hostElements: ledger.hostElements,
        exports: exports.length,
      });
      expect(f.pack.records.filter((r) => r.kind === "diag")).toEqual([]);
    },
    SLOW,
  );

  test(
    "Pack: the ledger `keel pack` writes is the file `keel ledger --write .keel/ledger.json` writes, and lists `Example` of the library `keelCharts`",
    () => {
      const f = packed();
      const again = writeLedger(f.lib, "again.json");
      expect(again.run.status).toBe(0);
      expect(again.text).toBe(readText(f.lib, ".keel/ledger.json"));
      const exports = ledgerIn(f.lib).exports;
      const names = Array.isArray(exports)
        ? exports.filter(isRecord).map((e) => `${String(e.pkg)}:${String(e.name)}`)
        : [];
      expect(names).toContain(`${LIB_ID}:Example`);
    },
    SLOW,
  );

  test(
    "Pack: `keel pack --check` runs the same steps, exits 0 when the ledger agrees, and writes nothing",
    () => {
      const f = packed();
      expect(f.check.status).toBe(0);
      expect(f.afterCheck).toEqual(f.beforeCheck);
    },
    SLOW,
  );
});

describe("Own folder", () => {
  test(
    "Own folder: `keel check` in the library's folder reads it as one module and is clean, with no E1162 for a folder that ships no ledger",
    () => {
      const lib = fresh();
      expect(existsSync(join(lib, ".keel/ledger.json"))).toBe(false);
      const r = keel(lib, ["check"]);
      expect(diags(r, "E1162")).toEqual([]);
      expect(r.records.filter((x) => x.kind === "diag")).toEqual([]);
      expect(r.status).toBe(0);
    },
    SLOW,
  );

  test(
    "Own folder: `keel test` in the library's folder runs its `test/` tests",
    () => {
      const r = keel(fresh(), ["test"]);
      expect(r.records.find((x) => x.kind === "summary")?.ok, JSON.stringify(r.records).slice(0, 600)).toBe(true);
      expect(r.status).toBe(0);
    },
    SLOW,
  );

  test(
    "Own folder: `keel test` in the library's folder runs its co-located tests",
    () => {
      const lib = fresh();
      writeFileSync(
        join(lib, "src/colocated.test.ts"),
        "import { expect, it } from 'vitest'\nit('co-located', () => {\n  expect(1).toBe(2)\n})\n",
      );
      const r = keel(lib, ["test"]);
      expect(r.records.find((x) => x.kind === "summary")?.ok).toBe(false);
      expect(r.status).not.toBe(0);
    },
    SLOW,
  );

  test(
    "Own folder: `keel ledger` counts the `unsafe(...)` calls and `Host` elements of `src/` and `unsafe/`, lists `Example` among `exports`, and its `libraries` is `{}`",
    () => {
      const lib = fresh();
      mkdirSync(join(lib, "unsafe"), { recursive: true });
      writeFileSync(join(lib, "unsafe/u.ts"), unsafeSrc(1));
      for (const [rel, text] of Object.entries(hostFiles(2))) writeFileSync(join(lib, rel), text);
      const w = writeLedger(lib, "out.json");
      expect(w.run.status).toBe(0);
      const j = isRecord(w.json) ? w.json : {};
      expect(j.unsafe).toBe(1);
      expect(j.hostElements).toBe(2);
      expect(j.libraries).toEqual({});
      const exports = Array.isArray(j.exports) ? j.exports.filter(isRecord) : [];
      expect(exports.some((e) => e.pkg === LIB_ID && e.name === "Example")).toBe(true);
    },
    SLOW,
  );

  test(
    "Own folder: the root `tokens.ts` is read as the library's tokens: one that throws is one E1807 at `tokens.ts`, line 1, column 1 (k.a11y-static Tokens)",
    () => {
      const lib = fresh();
      writeFileSync(join(lib, "tokens.ts"), "throw new Error('library tokens')\n");
      const r = keel(lib, ["check"]);
      const found = diags(r, "E1807");
      expect(found.length, JSON.stringify(r.records).slice(0, 600)).toBe(1);
      expect(found[0]).toMatchObject({ path: "tokens.ts", line: 1, col: 1 });
      expect(r.status).toBe(1);
    },
    SLOW,
  );

  const rules: [string, string, string][] = [
    ["E1161", '<Text id="literal">x</Text>', "import { Text } from '@keel/ui'\n"],
    ["E1757", "<Text id={`${props.id}.text`}>{1 as unknown as string}</Text>", "import { Text } from '@keel/ui'\n"],
    [
      "E1163",
      "<Text id={`${props.id}.text`}>{String(outside)}</Text>",
      "import { Text } from '@keel/ui'\nimport outside from '../../outside.ts'\n",
    ],
    [
      "E1576",
      "<Text id={`${props.id}.text`}>{typeof stores}</Text>",
      "import { Text } from '@keel/ui'\nimport * as stores from '@keel/store/internal'\n",
    ],
  ];
  for (const [code, body, head] of rules) {
    test(
      `Own folder: every k.library rule holds in the library's own folder: ${code} is one diagnostic at \`src/Example.tsx\` from \`keel check\``,
      () => {
        const lib = fresh();
        writeFileSync(join(lib, "../outside.ts"), "export default 1\n");
        writeExample(lib, body, head);
        const r = keel(lib, ["check"]);
        const found = diags(r, code);
        expect(found.length, JSON.stringify(r.records).slice(0, 800)).toBe(1);
        expect(found[0]?.path).toBe("src/Example.tsx");
        expect(r.status).toBe(1);
      },
      SLOW,
    );
  }
});

describe("Conformance 3: keel pack refuses", () => {
  test(
    "In that scaffolded library, a test made to fail makes `keel pack` report one E1164 whose message names `test`, and no `.keel/ledger.json` is written",
    () => {
      const lib = fresh();
      writeFileSync(
        join(lib, "test/Fail.test.ts"),
        "import { expect, it } from 'vitest'\nit('fails', () => {\n  expect(1).toBe(2)\n})\n",
      );
      const before = snapshot(lib);
      const r = pack(lib);
      expect(namesOnly(r, "test"), JSON.stringify(r.records).slice(0, 800)).toBe(true);
      expect(r.status).toBe(1);
      expect(existsSync(join(lib, ".keel/ledger.json"))).toBe(false);
      expect(snapshot(lib)).toEqual(before);
    },
    SLOW,
  );

  test(
    "In that scaffolded library, `<text />` in `src/Example.tsx` makes `keel pack` report one E1805 and one E1164 naming `check`",
    () => {
      const lib = fresh();
      writeExample(lib, "<text />");
      const before = snapshot(lib);
      const r = pack(lib);
      expect(diags(r, "E1805").length).toBe(1);
      expect(namesOnly(r, "check")).toBe(true);
      expect(r.status).toBe(1);
      expect(snapshot(lib)).toEqual(before);
    },
    SLOW,
  );

  test(
    "Pack: `keel pack` stops at the first step that fails: a failing `check` and a failing test report one E1164 naming `check` and run no test",
    () => {
      const lib = fresh();
      writeExample(lib, "<text />");
      writeFileSync(
        join(lib, "test/Fail.test.ts"),
        "import { expect, it } from 'vitest'\nit('fails', () => {\n  expect(1).toBe(2)\n})\n",
      );
      const r = pack(lib);
      expect(namesOnly(r, "check")).toBe(true);
      expect(JSON.stringify(r.records)).not.toContain("Fail.test");
    },
    SLOW,
  );

  test(
    "Pack: a failing `check` leaves the `.keel/ledger.json` a library already holds as it was, and `keel pack` writes no file",
    () => {
      const lib = packedCopy();
      const before = snapshot(lib);
      writeExample(lib, "<text />");
      const edited = snapshot(lib);
      const r = pack(lib);
      expect(namesOnly(r, "check")).toBe(true);
      expect(snapshot(lib)).toEqual(edited);
      expect(readText(lib, ".keel/ledger.json")).toBe(before[".keel/ledger.json"]);
    },
    SLOW,
  );

  test(
    "Rules: E1164 names `ledger` when the ledger step fails (ASSUMED fixture: `.keel` is a file, so `.keel/ledger.json` cannot be written)",
    () => {
      const lib = fresh();
      writeFileSync(join(lib, ".keel"), "not a folder\n");
      const r = pack(lib);
      expect(namesOnly(r, "ledger"), JSON.stringify(r.records).slice(0, 800)).toBe(true);
      expect(r.status).toBe(1);
    },
    SLOW,
  );

  const refused: [string, string, string, string][] = [
    [
      "a cast outside `unsafe/`",
      "E1757",
      "<Text id={`${props.id}.text`}>{1 as unknown as string}</Text>",
      "import { Text } from '@keel/ui'\n",
    ],
    ["a literal element id", "E1161", '<Text id="literal">x</Text>', "import { Text } from '@keel/ui'\n"],
  ];
  for (const [what, code, body, head] of refused) {
    test(
      `A library with ${what} does not pass \`keel pack\`: one ${code} and one E1164 naming \`check\`, no ledger written`,
      () => {
        const lib = fresh();
        writeExample(lib, body, head);
        const r = pack(lib);
        expect(diags(r, code).length).toBe(1);
        expect(namesOnly(r, "check")).toBe(true);
        expect(existsSync(join(lib, ".keel/ledger.json"))).toBe(false);
      },
      SLOW,
    );
  }
});

describe("Conformance 4: keel pack --check", () => {
  test(
    "In that scaffolded library, after `keel pack`, adding `Host` to `src/Example.tsx` makes `keel pack --check` report one E1164 naming `ledger` and leaves `.keel/ledger.json` unchanged; `keel pack` then writes `hostElements` 1",
    () => {
      const lib = packedCopy();
      const shipped = readText(lib, ".keel/ledger.json");
      exampleWithHost(lib, 1);
      const r = pack(lib, true);
      expect(namesOnly(r, "ledger"), JSON.stringify(r.records).slice(0, 800)).toBe(true);
      expect(r.status).toBe(1);
      expect(readText(lib, ".keel/ledger.json")).toBe(shipped);
      const w = pack(lib);
      expect(w.status, JSON.stringify(w.records).slice(0, 800)).toBe(0);
      expect(ledgerIn(lib).hostElements).toBe(1);
      expect(w.records.find((x) => x.kind === "summary")?.counts).toMatchObject({ hostElements: 1 });
      hostLibrary = lib;
    },
    SLOW,
  );

  test(
    "Pack: `keel pack --check` is E1164 naming `ledger` when `.keel/ledger.json` is missing, and writes nothing",
    () => {
      const lib = fresh();
      const before = snapshot(lib);
      const r = pack(lib, true);
      expect(namesOnly(r, "ledger"), JSON.stringify(r.records).slice(0, 800)).toBe(true);
      expect(snapshot(lib)).toEqual(before);
    },
    SLOW,
  );

  const tampered: [string, unknown][] = [
    ["unsafe", 1],
    ["hostElements", 1],
    ["exports", []],
  ];
  for (const [field, value] of tampered) {
    test(
      `Pack: \`keel pack --check\` is E1164 naming \`ledger\` when the shipped \`${field}\` differs from the one \`keel ledger --write\` would write`,
      () => {
        const lib = packedCopy();
        const j = ledgerIn(lib);
        j[field] = value;
        writeFileSync(join(lib, ".keel/ledger.json"), `${JSON.stringify(j, null, 2)}\n`);
        const before = snapshot(lib);
        const r = pack(lib, true);
        expect(namesOnly(r, "ledger")).toBe(true);
        expect(snapshot(lib)).toEqual(before);
      },
      SLOW,
    );
  }

  test(
    "Pack: a library whose files change after `keel ledger` (an `unsafe(...)` call added to `unsafe/raw.ts`) fails `keel pack --check` naming `ledger`",
    () => {
      const lib = packedCopy();
      mkdirSync(join(lib, "unsafe"), { recursive: true });
      writeFileSync(join(lib, "unsafe/raw.ts"), CLEAN_UNSAFE);
      const pkg = readJson(lib, "package.json");
      const files = isRecord(pkg) && Array.isArray(pkg.files) ? pkg.files : [];
      writeFileSync(
        join(lib, "package.json"),
        `${JSON.stringify({ ...(isRecord(pkg) ? pkg : {}), files: [...files, "unsafe"] }, null, 2)}\n`,
      );
      const r = pack(lib, true);
      expect(namesOnly(r, "ledger"), JSON.stringify(r.records).slice(0, 800)).toBe(true);
    },
    SLOW,
  );

  test(
    "Pack: a library whose files change after `keel ledger` (a second public export) fails `keel pack --check` naming `ledger`",
    () => {
      const lib = packedCopy();
      writeFileSync(
        join(lib, "module.ts"),
        `import { module } from '@keel/compiler'\nexport default module({ id: '${LIB_ID}', deps: [], capabilities: [], public: { exports: ['Example', 'Extra'] } })\n`,
      );
      writeFileSync(
        join(lib, "src/Extra.tsx"),
        "import { Text } from '@keel/ui'\nexport default function Extra(props: { id: string }) {\n  return <Text id={`${props.id}.text`}>extra</Text>\n}\n",
      );
      writeFileSync(
        join(lib, "src/index.ts"),
        "export { default as Example } from './Example.tsx'\nexport { default as Extra } from './Extra.tsx'\n",
      );
      const r = pack(lib, true);
      expect(namesOnly(r, "ledger"), JSON.stringify(r.records).slice(0, 800)).toBe(true);
    },
    SLOW,
  );

  test(
    "Pack: `keel pack --check` judges `unsafe`, `hostElements` and `exports` alone: other keys of the shipped file may differ",
    () => {
      const lib = packedCopy();
      const j = ledgerIn(lib);
      writeFileSync(
        join(lib, ".keel/ledger.json"),
        `${JSON.stringify({ ...j, extra: true, rungs: { example: 99 }, libraries: { x: 1 } }, null, 2)}\n`,
      );
      const r = pack(lib, true);
      expect(r.status, JSON.stringify(r.records).slice(0, 800)).toBe(0);
    },
    SLOW,
  );
});
/** The library of the fourth clause after its second `keel pack`: one `Host` element, shipped as such. */
let hostLibrary: string | undefined;

/** A folder that holds `package.json` without a `keel` field, and a root `module.ts`: no library. */
const NOT_A_LIBRARY = (): string => {
  const dir = materialize({
    "package.json": `${JSON.stringify({ name: "@acme/plain", version: "1.0.0", type: "module" })}\n`,
    "module.ts":
      "import { module } from '@keel/compiler'\nexport default module({ id: 'plain', deps: [], capabilities: [], public: { exports: [] } })\n",
  });
  made.push(dir);
  return dir;
};

describe("Conformance 5: the folder is no library", () => {
  test(
    "`keel pack` in a folder whose `package.json` has no `keel` field is one E1164 naming `kind`",
    () => {
      const dir = NOT_A_LIBRARY();
      const before = snapshot(dir);
      const r = pack(dir);
      expect(namesOnly(r, "kind"), JSON.stringify(r.records).slice(0, 800)).toBe(true);
      expect(r.status).toBe(1);
      expect(snapshot(dir)).toEqual(before);
    },
    SLOW,
  );

  test(
    "Pack: `keel pack --check` run outside a library's folder is one E1164 naming `kind`, and so is a folder with no `package.json`",
    () => {
      const dir = NOT_A_LIBRARY();
      const before = snapshot(dir);
      const r = pack(dir, true);
      expect(namesOnly(r, "kind"), JSON.stringify(r.records).slice(0, 800)).toBe(true);
      expect(snapshot(dir)).toEqual(before);
      const empty = materialize({});
      made.push(empty);
      const none = pack(empty);
      expect(namesOnly(none, "kind"), JSON.stringify(none.records).slice(0, 800)).toBe(true);
      expect(none.status).toBe(1);
    },
    SLOW,
  );
});

describe("Package: what a tarball carries and what an app does with it", () => {
  test(
    "Package: the tarball the package manager makes holds `module.ts`, `src/`, `dist/`, `.keel/ledger.json` and `package.json`, with the `keel` condition first and at the source path, and no `.env`, `node_modules/`, `test/` or root `tokens.ts`",
    () => {
      const lib = packedCopy();
      writeFileSync(join(lib, ".env"), "SECRET=1\n");
      mkdirSync(join(lib, "node_modules_here"), { recursive: true });
      const t = packTarball(lib);
      expect(t.status, t.output.slice(-800)).toBe(0);
      const entries = t.tgz === undefined ? [] : tarEntries(t.tgz);
      for (const want of [
        "module.ts",
        "src/index.ts",
        "src/Example.tsx",
        ".keel/ledger.json",
        "dist/src/index.js",
        "dist/src/index.d.ts",
        "package.json",
      ])
        expect(entries, want).toContain(`package/${want}`);
      for (const refuse of [".env", "node_modules", "test/", "tokens.ts"])
        expect(
          entries.filter((e) => e.startsWith(`package/${refuse}`)),
          refuse,
        ).toEqual([]);
      const pkg = readJson(lib, "package.json");
      const dot = isRecord(pkg) && isRecord(pkg.exports) ? pkg.exports["."] : undefined;
      expect(isRecord(dot) ? Object.keys(dot) : []).toEqual(["keel", "types", "default"]);
    },
    SLOW,
  );

  test(
    "Pack: a tarball is made by the package manager, whose `prepack` runs `keel pack --check`: a library whose ledger is stale (`Host` added after `keel pack`) makes no tarball",
    () => {
      const lib = packedCopy();
      exampleWithHost(lib, 1);
      const t = packTarball(lib);
      expect(t.status).not.toBe(0);
      expect(t.tgz).toBeUndefined();
      expect(t.output).toContain("E1164");
    },
    SLOW,
  );

  test(
    "A library shipped with a stale ledger (a tarball made with its scripts off) is E1162 in the app: `ships hostElements 0, its files hold 1`",
    () => {
      const lib = packedCopy();
      exampleWithHost(lib, 1);
      const t = packTarball(lib, true);
      expect(t.status, t.output.slice(-800)).toBe(0);
      const app = appWithTarball(t.tgz ?? "");
      made.push(app);
      const r = keel(app, ["check"]);
      const e = diags(r, "E1162");
      expect(e.map((x) => x.message)).toEqual([`${LIB_NAME} ships hostElements 0, its files hold 1`]);
    },
    SLOW,
  );
});

describe("The round trip: scaffold, pack, install the tarball, use it in an app", () => {
  let app: string | undefined;
  const installed = (): string => {
    if (app === undefined) {
      const lib = packed().lib;
      const t = packTarball(lib);
      expect(t.status, t.output.slice(-800)).toBe(0);
      app = appWithTarball(t.tgz ?? "");
      made.push(app);
    }
    return app;
  };

  test(
    "an app listing the packed library in a module's `deps`: `keel check` reports no diagnostic, not even E1162",
    () => {
      const r = keel(installed(), ["check"]);
      expect(
        r.records.filter((x) => x.kind === "diag"),
        JSON.stringify(r.records).slice(0, 800),
      ).toEqual([]);
      expect(r.status).toBe(0);
    },
    SLOW,
  );

  test(
    "`keel build` of that app exits 0 and `dist/site/index.html` holds the library's element, `shop.example.text`",
    () => {
      const dir = installed();
      const r = keel(dir, ["build"]);
      expect(r.status, JSON.stringify(r.records).slice(0, 800)).toBe(0);
      expect(readFileSync(join(dir, "dist/site/index.html"), "utf8")).toContain('id="shop.example.text"');
    },
    SLOW,
  );

  test(
    "`keel ledger --write` in that app prints one summary record, and writes `libraries` with the counts of the shipped file and no E1162",
    () => {
      const dir = installed();
      const shipped = ledgerIn(join(dir, "node_modules", LIB_NAME));
      const w = writeLedger(dir, "out.json");
      expect(w.run.status, JSON.stringify(w.run.records).slice(0, 600)).toBe(0);
      expect(diags(w.run, "E1162")).toEqual([]);
      const summaries = w.run.records.filter((x) => x.kind === "summary");
      expect(summaries.length).toBe(1);
      expect(summaries[0]?.ok).toBe(true);
      expect(isRecord(summaries[0]?.counts)).toBe(true);
      const j = isRecord(w.json) ? w.json : {};
      expect(isRecord(j.libraries) ? j.libraries[LIB_NAME] : undefined).toEqual({
        version: "0.1.0",
        unsafe: shipped.unsafe,
        hostElements: shipped.hostElements,
      });
    },
    SLOW,
  );

  test(
    "`keel ledger` in that app emits, per entry of the shipped `exports`, `{ kind: 'ledger', item: '<name>/<file>#<export>', rung, evidence: 'library <version>' }`",
    () => {
      const dir = installed();
      const shipped = ledgerIn(join(dir, "node_modules", LIB_NAME));
      const entries = Array.isArray(shipped.exports) ? shipped.exports.filter(isRecord) : [];
      expect(entries.length).toBeGreaterThan(0);
      const r = keel(dir, ["ledger"]);
      expect(diags(r, "E1162")).toEqual([]);
      const items = r.records.filter((x) => x.kind === "ledger");
      for (const e of entries)
        expect(items).toContainEqual(
          expect.objectContaining({
            item: `${LIB_NAME}/${String(e.file)}#${String(e.name)}`,
            rung: e.rung,
            evidence: "library 0.1.0",
          }),
        );
    },
    SLOW,
  );

  test(
    "a tarball whose shipped ledger lies (`unsafe` edited to 1 before it is installed) is one E1162 in the app, `ships unsafe 1, its files hold 0`, and `keel ledger` shows none of the library's items",
    () => {
      const t = packTarball(packed().lib);
      expect(t.status, t.output.slice(-800)).toBe(0);
      const lying = editTarball(t.tgz ?? "", ".keel/ledger.json", (text) => {
        const j: unknown = JSON.parse(text);
        return `${JSON.stringify({ ...(isRecord(j) ? j : {}), unsafe: 1 })}\n`;
      });
      const dir = appWithTarball(lying);
      made.push(dir);
      const c = keel(dir, ["check"]);
      expect(
        c.records.filter((x) => x.kind === "diag").map((x) => [x.code, x.message]),
        JSON.stringify(c.records).slice(0, 600),
      ).toEqual([["E1162", `${LIB_NAME} ships unsafe 1, its files hold 0`]]);
      expect(c.status).toBe(1);
      const l = keel(dir, ["ledger"]);
      expect(diags(l, "E1162")).toEqual([]);
      expect(l.records.filter((x) => x.kind === "ledger" && String(x.item).startsWith(`${LIB_NAME}/`))).toEqual([]);
    },
    SLOW,
  );

  test(
    "a library with one `Host` element, packed and installed the same way, is clean in the app and counted as shipped: `libraries` holds `hostElements` 1",
    () => {
      // Runs after the fourth clause's test, which leaves its library packed with one `Host` element.
      const lib = hostLibrary;
      expect(lib, "the Conformance 4 test above leaves its library").toBeDefined();
      const t = packTarball(lib ?? "");
      expect(t.status, t.output.slice(-800)).toBe(0);
      const dir = appWithTarball(t.tgz ?? "");
      made.push(dir);
      const c = keel(dir, ["check"]);
      expect(
        c.records.filter((x) => x.kind === "diag"),
        JSON.stringify(c.records).slice(0, 800),
      ).toEqual([]);
      const w = writeLedger(dir, "out.json");
      const j = isRecord(w.json) ? w.json : {};
      expect(isRecord(j.libraries) ? j.libraries[LIB_NAME] : undefined).toEqual({
        version: "0.1.0",
        unsafe: 0,
        hostElements: 1,
      });
    },
    SLOW,
  );
});
