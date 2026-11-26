// Spec: k.looks, clause "In the fixed project, `\"./tokens\":{\"default\":\"./evil.js\",\"keel\":\"./src/acmeTokens.ts\"}` is one E1815 at the `'@acme/ui'` entry with message `@acme/ui exports \"./tokens\" lists keel after another condition`, and `evil.js`, which writes a file when run, writes none during `keel check`; `\"./tokens\":{\"import\":{\"keel\":\"./src/acmeTokens.ts\"}}` and `\".\":{\"node\":\"./index.js\",\"keel\":\"./src/index.ts\"}` are each one E1815."
// Spec: k.looks, clause "**Entries.** In each listed library's `package.json` `exports`, an entry holding `keel` holds it as its first key and nowhere deeper, else E1815 at each `deps` entry naming the library (`<name> exports \"<key>\" lists keel after another condition`, or `<name> exports \"<key>\" nests keel under another condition` when `keel` sits only deeper). `keel check` judges this before it evaluates `tokens.ts`, and evaluates none while an E1815 stands, so the file check reads as source is the file the compiler and `tokens.ts`'s evaluation resolve (both take the `keel` condition, k.library)."
// Seed: 1337 (no generated input: one spawned `keel check` per entry shape, each in its own project).
// The `evil.js` half of the clause: the library's `./tokens` target that would run is `./evil.js`, which writes a marker file under a temp folder of the test; the root `tokens.ts` imports `@acme/ui/tokens`, so evaluating it with the wrong target
// would write the marker. `check()` (packages/check/conformance/library-entries-e1815.test.ts) evaluates nothing, so the mark is read here, over the real binary.
// ASSUMPTIONS: the project is staticTree's with module `s` listing `'@acme/ui'` and the library's files under `node_modules/@acme/ui/`; a diagnostic's `path` is the `modules/s/module.ts` line holding the `deps` entry. The other entry shapes (a `node` or `import` condition before `keel`, `keel` nested) are the reviewer's attacks on the same sentence.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { cleanup, diags, keel, materialize, type Tree } from "./compat-support.ts";
import { SLOW, staticTree } from "./static-support.ts";

const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;
const SRC = "./src/acmeTokens.ts";
const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});

function project(tokensEntry: unknown, marker: string): Tree {
  const root = "node_modules/@acme/ui";
  const exports = {
    ".": { keel: "./src/index.ts", default: "./index.js" },
    "./tokens": tokensEntry,
  };
  return {
    ...staticTree(),
    "modules/s/module.ts":
      "import { module } from '@keel/compiler'\nexport default module({ id: 's', deps: ['@acme/ui'], capabilities: [], public: { exports: [] } })\n",
    "tokens.ts": `import { defineTokens } from "@keel/ui";\nimport { brandTokens } from "@keel/ui/brand";\nimport { acmeTokens } from "@acme/ui/tokens";\n\nexport const tokens = defineTokens({\n  ...brandTokens,\n  color: { ...brandTokens.color, ...acmeTokens.color },\n  look: { ...brandTokens.look, ...acmeTokens.look },\n});\n`,
    [`${root}/package.json`]: JSON.stringify(
      { name: "@acme/ui", version: "1.0.0", type: "module", keel: "library", exports },
      null,
      2,
    ),
    [`${root}/index.js`]: "export {}\n",
    [`${root}/evil.js`]: `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, "ran");\nexport const acmeTokens = { color: {}, look: {} };\n`,
    [`${root}/module.ts`]:
      "import { module } from '@keel/compiler'\nexport default module({ id: 'acme', deps: [], capabilities: [], public: { exports: ['Badge'] } })\n",
    [`${root}/src/index.ts`]: "export { default as Badge } from './Badge.tsx'\n",
    [`${root}/src/Badge.tsx`]:
      "import { Text } from '@keel/ui'\nexport default function Badge(props: { id: string }) { return <Text id={`${props.id}.text`} look=\"acme.badge\">x</Text> }\n",
    [`${root}/src/acmeTokens.ts`]:
      "import { defineTokens } from '@keel/ui'\nexport const acmeTokens = defineTokens({ color: { 'acme.accent': '#0B5CAD', 'acme.ink': '#FFFFFF' }, look: { 'acme.badge': { bg: 'acme.accent', fg: 'acme.ink' } } })\n",
    [`${root}/.keel/ledger.json`]: LEDGER,
  };
}

const SHAPES: { label: string; entry: (evil: string) => unknown; message: string }[] = [
  {
    label: "`default` before `keel`",
    entry: (e) => ({ default: e, keel: SRC }),
    message: '@acme/ui exports "./tokens" lists keel after another condition',
  },
  {
    label: "`node` before `keel`",
    entry: (e) => ({ node: e, keel: SRC }),
    message: '@acme/ui exports "./tokens" lists keel after another condition',
  },
  {
    label: "`import` before `keel`",
    entry: (e) => ({ import: e, keel: SRC }),
    message: '@acme/ui exports "./tokens" lists keel after another condition',
  },
  {
    label: "`keel` nested under `import`, `default` beside it",
    entry: (e) => ({ import: { keel: SRC }, default: e }),
    message: '@acme/ui exports "./tokens" nests keel under another condition',
  },
  {
    label: "`keel` nested under `node`, with the unsafe target inside",
    entry: (e) => ({ node: { default: e, keel: SRC } }),
    message: '@acme/ui exports "./tokens" nests keel under another condition',
  },
];

for (const shape of SHAPES) {
  test(
    `with ${shape.label} in \`./tokens\`, \`keel check\` reports one E1815 at the \`'@acme/ui'\` entry and \`evil.js\`, which writes a file when run, writes none`,
    () => {
      const folder = mkdtempSync(join(tmpdir(), "keel-e1815-"));
      made.push(folder);
      const marker = join(folder, "ran.txt");
      const dir = materialize(project(shape.entry(`./evil.js`), marker));
      made.push(dir);
      const run = keel(dir, ["check"]);
      const found = diags(run, "E1815");
      expect(found).toHaveLength(1);
      expect(found[0]?.message).toBe(shape.message);
      expect(String(found[0]?.path)).toBe("modules/s/module.ts");
      expect(existsSync(marker), "tokens.ts was evaluated while an E1815 stood").toBe(false);
      expect(run.status).not.toBe(0);
    },
    SLOW,
  );
}

test(
  "with `keel` first in `./tokens`, `keel check` reports no E1815 and `evil.js` is not the file `tokens.ts` resolves to",
  () => {
    const folder = mkdtempSync(join(tmpdir(), "keel-e1815-"));
    made.push(folder);
    const marker = join(folder, "ran.txt");
    const dir = materialize(project({ keel: SRC, default: "./evil.js" }, marker));
    made.push(dir);
    const run = keel(dir, ["check"]);
    expect(diags(run, "E1815")).toEqual([]);
    expect(existsSync(marker)).toBe(false);
    rmSync(folder, { recursive: true, force: true });
  },
  SLOW,
);
