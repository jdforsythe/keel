// Spec: k.looks, clause "With `src/acmeTokens.ts` beginning `import \"../evil.js\";`, `keel check` in the fixed project reports one E1812 with message `acmeTokens.ts holds another import; it is one defineTokens literal`, and `evil.js`, which writes a file when run, writes none during `keel check` or `keel build`."
// Spec: k.looks, clause "**Shipped tokens.** A library ships tokens through the `./tokens` entry of its `package.json` `exports`, whose `keel` target is `./src/<id>Tokens.ts`; the entry is held to k.library-pack Package as any entry is. That file holds `import { defineTokens } from '@keel/ui'` and `export const <id>Tokens = defineTokens({ ... })` and nothing else. The argument is an object literal whose keys are identifiers or string literals and whose values are string literals or such object literals: no spread, name, call, template, `as` or `satisfies` (`defineTokens` keeps the literal types). It holds k.ui's groups but `base`, and no `schemes` (k.schemes); every name in a group and every `look` key begins `<id>.`; each token a look names is one the object holds; it passes `TokenSchema`. A top-level `base` or `schemes` key gets its own E1812 message whatever its value, before its value's form is judged. Nothing runs it: its form (E1812) is judged from its text before anything of the project is evaluated, and the evaluation of `tokens.ts` (k.a11y-static Tokens) takes `<name>/tokens`, or `./src/<id>Tokens.ts` in the library's own folder, as a module made from the literal (`export const <id>Tokens = <the literal's data>`), never the file; while an E1812 or E1815 stands for a listed library, `tokens.ts` is not evaluated. Its export is not a ledger export (k.library-pack Own folder)."
// Spec: k.entries, clause "**Shape.** A listed library's `package.json` `exports` is an object, and each entry is an object whose first key is `keel` and whose `keel` value is a string naming a file under `src/` or `unsafe/` (`./tools` included, whose other conditions Node reads). Anything else is E1815 at each `deps` entry naming the library: an `exports` that is a string or an array (`<name> exports is no object`); an entry that is a string, an array or `null` (`<name> exports \"<key>\" is no object with keel first`); `keel` after another key (`<name> exports \"<key>\" lists keel after another condition`) or only deeper (`<name> exports \"<key>\" nests keel under another condition`); a `keel` value that is no string or names no such file (`<name> exports \"<key>\" keel names no file`); a key with `*` that matches a subpath a file check reads imports from the library (`<name> exports \"<key>\" matches \"<subpath>\"; give it an entry`). E1815 is judged from `package.json`'s text before anything of the project is evaluated or bundled, and while one stands no file of that library is evaluated or bundled and `tokens.ts` is not evaluated, so the file check reads is the one every surface loads."
// Seed: 1337 (no generated input: one spawned `keel check` and `keel build` per shipped file, each in its own project).
// The shipped tokens file is never evaluated: a file out of form (a side effect `evil.js` or the file's own top level would run) is one E1812 and no marker is written by `keel check` or `keel build`, and the root `tokens.ts`, which writes a second marker at its top level, is not evaluated while the E1812 stands (k.looks Shipped tokens). A well-formed file composes into the app: `keel check` reports nothing and the built CSS holds the literal's data.
// ASSUMPTIONS: the project is staticTree's `static` deployable with module `s` listing `'@acme/ui'`, the library's files under `node_modules/@acme/ui/`; the E1812's message is the first node out of form's (`another import`, `another statement`, `a computed value`). The marker files live in a temp folder of the test.
// Not asserted: that `tokens.ts`'s evaluation "takes `<name>/tokens` as a module made from the literal" for a well-formed file: a file that evaluates the same way and one made from the literal give the same tokens, so no test through the binary tells them apart.
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { type Tree, cleanup, diags, keel, materialize } from "./compat-support.ts";
import { SLOW, staticTree } from "./static-support.ts";

const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;
const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});
const LITERAL = `defineTokens({ color: { 'acme.accent': '#0B5CAD', 'acme.ink': '#FFFFFF' }, look: { 'acme.badge': { bg: 'acme.accent', fg: 'acme.ink' } } })`;

function project(shipped: string, evilMarker: string, rootMarker?: string): Tree {
  const root = "node_modules/@acme/ui";
  return {
    ...staticTree(),
    "modules/s/module.ts":
      "import { module } from '@keel/compiler'\nexport default module({ id: 's', deps: ['@acme/ui'], capabilities: [], public: { exports: [] } })\n",
    "tokens.ts": `import { defineTokens } from "@keel/ui";\nimport { brandTokens } from "@keel/ui/brand";\nimport { acmeTokens } from "@acme/ui/tokens";\n${rootMarker === undefined ? "" : `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(rootMarker)}, "ran");\n`}\nexport const tokens = defineTokens({\n  ...brandTokens,\n  color: { ...brandTokens.color, ...acmeTokens.color },\n  look: { ...brandTokens.look, ...acmeTokens.look },\n});\n`,
    [`${root}/package.json`]: JSON.stringify(
      {
        name: "@acme/ui",
        version: "1.0.0",
        type: "module",
        keel: "library",
        exports: {
          ".": { keel: "./src/index.ts", default: "./index.js" },
          "./tokens": { keel: "./src/acmeTokens.ts", default: "./index.js" },
        },
      },
      null,
      2,
    ),
    [`${root}/index.js`]: "export {}\n",
    [`${root}/evil.js`]: `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(evilMarker)}, "ran");\n`,
    [`${root}/module.ts`]:
      "import { module } from '@keel/compiler'\nexport default module({ id: 'acme', deps: [], capabilities: [], public: { exports: ['Badge'] } })\n",
    [`${root}/src/index.ts`]: "export { default as Badge } from './Badge.tsx'\n",
    [`${root}/src/Badge.tsx`]:
      "import { Text } from '@keel/ui'\nexport default function Badge(props: { id: string }) { return <Text id={`${props.id}.text`} look=\"acme.badge\">x</Text> }\n",
    [`${root}/src/acmeTokens.ts`]: shipped,
    [`${root}/.keel/ledger.json`]: LEDGER,
  };
}
const folder = (): { evil: string; root: string; side: string } => {
  const d = mkdtempSync(join(tmpdir(), "keel-never-run-"));
  made.push(d);
  return { evil: join(d, "evil.txt"), root: join(d, "root.txt"), side: join(d, "side.txt") };
};

test(
  'with `src/acmeTokens.ts` beginning `import "../evil.js";`, `keel check` in the fixed project reports one E1812 with message `acmeTokens.ts holds another import; it is one defineTokens literal`, and `evil.js`, which writes a file when run, writes none during `keel check` or `keel build`',
  () => {
    const f = folder();
    const shipped = `import "../evil.js";\nimport { defineTokens } from '@keel/ui'\nexport const acmeTokens = ${LITERAL}\n`;
    const dir = materialize(project(shipped, f.evil, f.root));
    made.push(dir);
    const check = keel(dir, ["check"]);
    const found = diags(check, "E1812");
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toBe("acmeTokens.ts holds another import; it is one defineTokens literal");
    expect(check.status).not.toBe(0);
    const build = keel(dir, ["build"]);
    expect(diags(build, "E1812")).toHaveLength(1);
    expect(build.status).not.toBe(0);
    expect(existsSync(f.evil), "evil.js ran").toBe(false);
    expect(existsSync(f.root), "tokens.ts was evaluated while an E1812 stood").toBe(false);
  },
  SLOW * 2,
);

const FORBIDDEN: { label: string; message: string; source: (marker: string) => string }[] = [
  {
    label: "an import of `node:fs` and a write at the file's top level",
    message: "acmeTokens.ts holds another import; it is one defineTokens literal",
    source: (m) =>
      `import { defineTokens } from '@keel/ui'\nimport { writeFileSync } from 'node:fs'\nwriteFileSync(${JSON.stringify(m)}, 'ran')\nexport const acmeTokens = ${LITERAL}\n`,
  },
  {
    label: "a top-level statement that writes the marker with no import",
    message: "acmeTokens.ts holds another statement; it is one defineTokens literal",
    source: (m) =>
      `import { defineTokens } from '@keel/ui'\nprocess.getBuiltinModule('node:fs').writeFileSync(${JSON.stringify(m)}, 'ran')\nexport const acmeTokens = ${LITERAL}\n`,
  },
  {
    label: "a call inside the literal that writes the marker",
    message: "acmeTokens.ts holds a computed value; it is one defineTokens literal",
    source: (m) =>
      `import { defineTokens } from '@keel/ui'\nexport const acmeTokens = defineTokens({ color: { 'acme.accent': (process.getBuiltinModule('node:fs').writeFileSync(${JSON.stringify(m)}, 'ran'), '#0B5CAD'), 'acme.ink': '#FFFFFF' }, look: { 'acme.badge': { bg: 'acme.accent', fg: 'acme.ink' } } })\n`,
  },
];
for (const c of FORBIDDEN) {
  test(
    `a shipped file with ${c.label} is one E1812 \`${c.message}\`, and neither it nor \`tokens.ts\` runs during \`keel check\` or \`keel build\``,
    () => {
      const f = folder();
      const dir = materialize(project(c.source(f.side), f.evil, f.root));
      made.push(dir);
      const check = keel(dir, ["check"]);
      const found = diags(check, "E1812");
      expect(found).toHaveLength(1);
      expect(found[0]?.message).toBe(c.message);
      expect(check.status).not.toBe(0);
      const build = keel(dir, ["build"]);
      expect(diags(build, "E1812")).toHaveLength(1);
      expect(build.status).not.toBe(0);
      expect(existsSync(f.side), "the shipped file ran").toBe(false);
      expect(existsSync(f.root), "tokens.ts was evaluated while an E1812 stood").toBe(false);
    },
    SLOW * 2,
  );
}

test(
  "a well-formed shipped file composes into the app: `keel check` reports no E1812, `keel build` exits 0 and its CSS holds the literal's `--k-color-acme-accent:#0B5CAD` (compared in lower case, as a stylesheet minifier writes a hex color)",
  () => {
    const f = folder();
    const shipped = `import { defineTokens } from '@keel/ui'\nexport const acmeTokens = ${LITERAL}\n`;
    const dir = materialize(project(shipped, f.evil));
    made.push(dir);
    const check = keel(dir, ["check"]);
    expect(diags(check, "E1812")).toEqual([]);
    const build = keel(dir, ["build"]);
    expect(build.status).toBe(0);
    const assets = join(dir, "dist", "site", "assets");
    const css = readdirSync(assets)
      .filter((n) => n.endsWith(".css"))
      .map((n) => readFileSync(join(assets, n), "utf8"))
      .join("\n");
    expect(css.toLowerCase()).toContain("--k-color-acme-accent:#0b5cad");
    expect(existsSync(f.evil)).toBe(false);
  },
  SLOW * 2,
);
