// Spec: k.looks, clause "In that own folder, a fixture key `'acme.accent': '#000000'` after the spread is one E1813 with message `color \"acme.accent\": the fixture overrides acme's default`, and `keel pack` then reports it and one E1164 naming `check`."
// k.looks, Own folder: "`keel pack` runs all of it in its `check` step." (E1810, E1811 and E1813 of the own folder are reported by `keel pack`, and the E1164 names `check`.)
// k.library-pack, Rules: "E1164 `keel pack`: the step its message begins with failed (`kind`, `package`, `check`, `test`, `ledger`; Pack); nothing is written."
// Seed: 1337 (no generated input: one scaffolded library, copied once per case).
// ASSUMPTIONS: the scaffold writes no `src/<id>Tokens.ts` (RFC 0243 For the operator, 7), so the case writes it, the `./tokens` entry beside `.`, a `files` that selects what the entry names, and a root `tokens.ts`; the scaffolded library's id is `keelCharts` (its module id, library-support.ts `LIB_ID`) and its default tokens are `keelChartsTokens`. The `check` step is reached only when `kind` and `package` pass, so a refusal naming another step is a failure of this fixture and is reported as such.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import {
  LIB_ID,
  SLOW,
  cleanup,
  cloneLibrary,
  isRecord,
  namesOnly,
  pack,
  readJson,
  scaffolded,
  snapshot,
  str,
} from "./library-support.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});
let base: ReturnType<typeof scaffolded> | undefined;
const fresh = (): string => {
  if (base === undefined) {
    base = scaffolded();
    made.push(base.scratchDir);
  }
  return cloneLibrary(base.lib);
};

const TOKENS_FILE = `${LIB_ID}Tokens`;
const SHIPPED = `import { defineTokens } from '@keel/ui/tokens'\nexport const ${TOKENS_FILE} = defineTokens({ color: { '${LIB_ID}.accent': '#0B5CAD', '${LIB_ID}.ink': '#FFFFFF' }, look: { '${LIB_ID}.badge': { bg: '${LIB_ID}.accent', fg: '${LIB_ID}.ink' } } })\n`;
const root = (extra: string): string =>
  `import { defineTokens } from "@keel/ui/tokens";\nimport { brandTokens } from "@keel/ui/brand";\nimport { ${TOKENS_FILE} } from "./src/${TOKENS_FILE}.ts";\n\nexport const tokens = defineTokens({\n  ...brandTokens,\n  color: { ...brandTokens.color, ...${TOKENS_FILE}.color${extra} },\n  look: { ...brandTokens.look, ...${TOKENS_FILE}.look },\n});\n`;

/** A copy of the scaffolded library that ships `<id>Tokens`, its root `tokens.ts` holding `extra` after the shipped color spread. */
function shipping(extra: string): string {
  const lib = fresh();
  const pkg = readJson(lib, "package.json");
  if (!isRecord(pkg) || !isRecord(pkg.exports)) throw new Error("fixture: the scaffold's package.json");
  const dot = pkg.exports["."];
  const entry = isRecord(dot) ? dot : {};
  const next = {
    ...pkg,
    exports: {
      ...pkg.exports,
      "./tokens": {
        keel: `./src/${TOKENS_FILE}.ts`,
        ...(entry.types === undefined ? {} : { types: `./dist/src/${TOKENS_FILE}.d.ts` }),
        default: str(entry.default).replace(/index(\.js)$/, `${TOKENS_FILE}$1`),
      },
    },
  };
  writeFileSync(join(lib, "package.json"), `${JSON.stringify(next, null, 2)}\n`);
  writeFileSync(join(lib, "src", `${TOKENS_FILE}.ts`), SHIPPED);
  writeFileSync(join(lib, "tokens.ts"), root(extra));
  return lib;
}

test(
  "In that own folder, a fixture key `'acme.accent': '#000000'` after the spread is one E1813 with message `color \"acme.accent\": the fixture overrides acme's default`, and `keel pack` then reports it and one E1164 naming `check`",
  () => {
    const lib = shipping(`, '${LIB_ID}.accent': '#000000'`);
    const before = snapshot(lib);
    const run = pack(lib);
    const found = run.records.filter((r) => r.kind === "diag" && r.code === "E1813");
    expect(found.length, JSON.stringify(run.records).slice(0, 900)).toBe(1);
    expect(found[0]?.message).toBe(`color "${LIB_ID}.accent": the fixture overrides ${LIB_ID}'s default`);
    expect(namesOnly(run, "check"), JSON.stringify(run.records).slice(0, 900)).toBe(true);
    expect(run.status).toBe(1);
    expect(snapshot(lib), "nothing is written").toEqual(before);
  },
  SLOW,
);

test(
  "`keel pack --frozen` reports the same E1813 and the same E1164 naming `check`",
  () => {
    const lib = shipping(`, '${LIB_ID}.accent': '#000000'`);
    const run = pack(lib, true);
    expect(run.records.filter((r) => r.kind === "diag" && r.code === "E1813")).toHaveLength(1);
    expect(namesOnly(run, "check")).toBe(true);
  },
  SLOW,
);

test(
  "a root `tokens.ts` that composes the shipped object with no override leaves `keel pack` no E1810 and no E1813",
  () => {
    const lib = shipping("");
    const run = pack(lib);
    const codes = run.records.flatMap((r) => (r.kind === "diag" ? [str(r.code)] : []));
    expect(codes.filter((c) => c === "E1810" || c === "E1811" || c === "E1812" || c === "E1813")).toEqual([]);
  },
  SLOW,
);
