// Shape (k.entries): "**Shape.** A listed library's `package.json` `exports` is an object, and each entry is an object whose first key is `keel` and whose `keel` value is a string naming a file under `src/` or `unsafe/` (`./tools` included, whose other conditions Node reads). Anything else is E1815 at each `deps` entry naming the library: an `exports` that is a string or an array (`<name> exports is no object`); an entry that is a string, an array or `null` (`<name> exports \"<key>\" is no object with keel first`); `keel` after another key (`<name> exports \"<key>\" lists keel after another condition`) or only deeper (`<name> exports \"<key>\" nests keel under another condition`); a `keel` value that is no string or names no such file (`<name> exports \"<key>\" keel names no file`); a key with `*` that matches a subpath a file check reads imports from the library (`<name> exports \"<key>\" matches \"<subpath>\"; give it an entry`), unless an entry of its own names that subpath, which Node prefers and which is judged instead. E1815 is judged from `package.json`'s text before anything of the project is evaluated or bundled, and while one stands no file of that library is evaluated or bundled and `tokens.ts` is not evaluated, so the file check reads is the one every surface loads."
// Spec: k.entries, clause "`\"./tokens\":{\"default\":\"./evil.js\",\"keel\":\"./src/acmeTokens.ts\"}` is one E1815 at the `'@acme/ui'` entry with message `@acme/ui exports \"./tokens\" lists keel after another condition`, and `evil.js`, which writes a file when run, writes none during `keel check`; `\"./tokens\":{\"import\":{\"keel\":\"./src/acmeTokens.ts\"}}` and `\".\":{\"node\":\"./index.js\",\"keel\":\"./src/index.ts\"}` are each one E1815."
// Spec: k.entries, clause "Each of `\"./tokens\":[\"./evil.js\",{\"keel\":\"./src/acmeTokens.ts\"}]`, `\"./tokens\":\"./evil.js\"`, `\"./tokens\":null`, `\"./tokens\":{\"keel\":{\"default\":\"./evil.js\"}}`, `\"./tokens\":{\"keel\":\"./lib/t.ts\"}` and `exports` `\"./evil.js\"` is one E1815 at the `'@acme/ui'` entry, and `evil.js` writes no file during `keel check` or `keel build`."
// Spec: k.entries, clause "With no `./tokens` entry and `\"./*\":{\"keel\":\"./src/*.ts\",\"default\":\"./evil.js\"}`, `tokens.ts`'s import of `@acme/ui/tokens` is one E1815 with message `@acme/ui exports \"./*\" matches \"./tokens\"; give it an entry`, and `evil.js` writes no file during `keel check` or `keel build`."
// Seed: 1337 (no generated input: one spawned `keel` per entry shape and key, each in its own project).
// The `evil.js` half of the clauses: the library's refused entry targets `./evil.js`, which writes a marker file under a temp folder of the test; the root `tokens.ts` imports `@acme/ui/tokens` and also writes a second marker at its top level, so evaluating it, or the library's `./tokens` entry with the wrong target, would write one. `check()` (packages/check/conformance/library-entries-e1815.test.ts) evaluates nothing, so the marks are read here, over the real binary.
// `keel check`, `keel build` and `keel dev` are each run: dev is started with the folder's `startDev`, given the time `served` allows (it returns when the server answers or the process exits), then stopped; the markers are read after.
// ASSUMPTIONS: the project is staticTree's with module `s` listing `'@acme/ui'` and the library's files under `node_modules/@acme/ui/`; a diagnostic's `path` is the `modules/s/module.ts` line holding the `deps` entry. For a key other than `./tokens` the entry holds the refused shape and `./tokens` holds the fixture's own valid entry.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { type Tree, cleanup, diags, keel, materialize } from "./compat-support.ts";
import { SLOW, freePort, served, startDev, staticTree, stop, stopAll } from "./static-support.ts";

const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;
const SRC = "./src/acmeTokens.ts";
const EVIL = "./evil.js";
const made: string[] = [];
afterAll(async () => {
  await stopAll();
  for (const d of made) cleanup(d);
});

/** `exports` of the library: the fixture's entries with `key` holding `entry` (or `exports` as it is when `whole` is given). */
function project(entry: unknown, marker: string, key = "./tokens", whole?: unknown, rootMarker?: string): Tree {
  const root = "node_modules/@acme/ui";
  const exports = whole ?? {
    ".": { keel: "./src/index.ts", default: "./index.js" },
    "./tokens": { keel: SRC, default: "./index.js" },
    [key]: entry,
  };
  const side =
    rootMarker === undefined
      ? ""
      : `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(rootMarker)}, "ran");\n`;
  return {
    ...staticTree(),
    "modules/s/module.ts":
      "import { module } from '@keel/compiler'\nexport default module({ id: 's', deps: ['@acme/ui'], capabilities: [], public: { exports: [] } })\n",
    "tokens.ts": `import { defineTokens } from "@keel/ui/tokens";\nimport { brandTokens } from "@keel/ui/brand";\nimport { acmeTokens } from "@acme/ui/tokens";\n${side}\nexport const tokens = defineTokens({\n  ...brandTokens,\n  color: { ...brandTokens.color, ...acmeTokens.color },\n  look: { ...brandTokens.look, ...acmeTokens.look },\n});\n`,
    [`${root}/package.json`]: JSON.stringify(
      { name: "@acme/ui", version: "1.0.0", type: "module", keel: "library", exports },
      null,
      2,
    ),
    [`${root}/index.js`]: "export {}\n",
    [`${root}/lib/t.ts`]: "export const t = 1\n",
    [`${root}/evil.js`]: `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, "ran");\nexport const acmeTokens = { color: {}, look: {} };\n`,
    [`${root}/module.ts`]:
      "import { module } from '@keel/compiler'\nexport default module({ id: 'acme', deps: [], capabilities: [], public: { exports: ['Badge'] } })\n",
    [`${root}/src/index.ts`]: "export { default as Badge } from './Badge.tsx'\n",
    [`${root}/src/Badge.tsx`]:
      "import { Text } from '@keel/ui'\nexport default function Badge(props: { id: string }) { return <Text id={`${props.id}.text`} look=\"acme.badge\">x</Text> }\n",
    [`${root}/src/acmeTokens.ts`]:
      "import { defineTokens } from '@keel/ui/tokens'\nexport const acmeTokens = defineTokens({ color: { 'acme.accent': '#0B5CAD', 'acme.ink': '#FFFFFF' }, look: { 'acme.badge': { bg: 'acme.accent', fg: 'acme.ink' } } })\n",
    [`${root}/.keel/ledger.json`]: LEDGER,
  };
}

const markers = (): { folder: string; marker: string; rootMarker: string } => {
  const folder = mkdtempSync(join(tmpdir(), "keel-e1815-"));
  made.push(folder);
  return { folder, marker: join(folder, "ran.txt"), rootMarker: join(folder, "root-ran.txt") };
};

const noAfter = (key: string): string => `@acme/ui exports "${key}" lists keel after another condition`;
const noNest = (key: string): string => `@acme/ui exports "${key}" nests keel under another condition`;
const noObject = (key: string): string => `@acme/ui exports "${key}" is no object with keel first`;
const noFile = (key: string): string => `@acme/ui exports "${key}" keel names no file`;
const SHAPES: { label: string; entry: unknown; message: (key: string) => string }[] = [
  { label: "`default` before `keel`", entry: { default: EVIL, keel: SRC }, message: noAfter },
  { label: "`node` before `keel`", entry: { node: EVIL, keel: SRC }, message: noAfter },
  { label: "`import` before `keel`", entry: { import: EVIL, keel: SRC }, message: noAfter },
  {
    label: "`keel` nested under `import`, `default` beside it",
    entry: { import: { keel: SRC }, default: EVIL },
    message: noNest,
  },
  {
    label: "`keel` nested under `node`, with the unsafe target inside",
    entry: { node: { default: EVIL, keel: SRC } },
    message: noNest,
  },
  { label: 'an array `["./evil.js", { keel }]`', entry: [EVIL, { keel: SRC }], message: noObject },
  { label: 'a string `"./evil.js"`', entry: EVIL, message: noObject },
  { label: "`null`", entry: null, message: noObject },
  { label: "`keel` holding an object with `default`", entry: { keel: { default: EVIL } }, message: noFile },
  { label: "`keel` naming a file outside `src/` and `unsafe/`", entry: { keel: "./lib/t.ts" }, message: noFile },
];
const KEYS = [".", "./tokens", "./contract", "./routes", "./tools"] as const;
const noMarkers = (m: { marker: string; rootMarker: string }, when: string): void => {
  expect(existsSync(m.marker), `evil.js ran during ${when}`).toBe(false);
  expect(existsSync(m.rootMarker), `tokens.ts was evaluated during ${when} while an E1815 stood`).toBe(false);
};

for (const key of KEYS) {
  test(
    `each refused shape at \`"${key}"\`, \`keel check\` reports one E1815 at the \`'@acme/ui'\` entry with its message, exits non-zero, and \`evil.js\`, which writes a file when run, and \`tokens.ts\` write none`,
    () => {
      for (const shape of SHAPES) {
        const m = markers();
        const dir = materialize(project(shape.entry, m.marker, key, undefined, m.rootMarker));
        made.push(dir);
        const run = keel(dir, ["check"]);
        const found = diags(run, "E1815");
        expect(found, `${shape.label} at ${key}`).toHaveLength(1);
        expect(found[0]?.message).toBe(shape.message(key));
        expect(String(found[0]?.path)).toBe("modules/s/module.ts");
        expect(run.status).not.toBe(0);
        noMarkers(m, `keel check (${shape.label} at ${key})`);
      }
    },
    SLOW * 3,
  );

  test(
    `a refused shape at \`"${key}"\` makes \`keel build\` exit non-zero, print the E1815, write no \`dist/\` folder, and run neither \`evil.js\` nor \`tokens.ts\``,
    () => {
      for (const shape of [SHAPES[0], SHAPES[3], SHAPES[6], SHAPES[8]]) {
        if (shape === undefined) throw new Error("fixture: no shape");
        const m = markers();
        const dir = materialize(project(shape.entry, m.marker, key, undefined, m.rootMarker));
        made.push(dir);
        const run = keel(dir, ["build"]);
        const found = diags(run, "E1815");
        expect(found, `${shape.label} at ${key}`).toHaveLength(1);
        expect(found[0]?.message).toBe(shape.message(key));
        expect(run.status).not.toBe(0);
        expect(existsSync(join(dir, "dist"))).toBe(false);
        noMarkers(m, `keel build (${shape.label} at ${key})`);
      }
    },
    SLOW * 2,
  );

  test(
    `a refused shape at \`"${key}"\` is run by \`keel dev\` (started, given time to answer or exit, stopped) without running \`evil.js\` or \`tokens.ts\``,
    async () => {
      const m = markers();
      const dir = materialize(project({ default: EVIL, keel: SRC }, m.marker, key, undefined, m.rootMarker));
      made.push(dir);
      const port = await freePort();
      const p = startDev(dir, port);
      try {
        await served(p, port);
      } finally {
        await stop(p);
      }
      noMarkers(m, `keel dev (${key})`);
    },
    SLOW,
  );
}

test(
  "an `exports` that is the string `\"./evil.js\"` or an array is one E1815 `@acme/ui exports is no object` at the `'@acme/ui'` entry, and `evil.js` and `tokens.ts` write no file during `keel check` or `keel build`",
  () => {
    for (const whole of [EVIL, [EVIL, { keel: SRC }]]) {
      const m = markers();
      const dir = materialize(project(null, m.marker, "./tokens", whole, m.rootMarker));
      made.push(dir);
      const check = keel(dir, ["check"]);
      const found = diags(check, "E1815");
      expect(found).toHaveLength(1);
      expect(found[0]?.message).toBe("@acme/ui exports is no object");
      expect(String(found[0]?.path)).toBe("modules/s/module.ts");
      expect(check.status).not.toBe(0);
      const build = keel(dir, ["build"]);
      expect(diags(build, "E1815")).toHaveLength(1);
      expect(build.status).not.toBe(0);
      noMarkers(m, "keel check and keel build");
    }
  },
  SLOW * 2,
);

test(
  'with no `./tokens` entry and `"./*":{"keel":"./src/*.ts","default":"./evil.js"}`, `tokens.ts`\'s import of `@acme/ui/tokens` is one E1815 with message `@acme/ui exports "./*" matches "./tokens"; give it an entry`, and `evil.js` and `tokens.ts` write no file during `keel check` or `keel build`',
  () => {
    const m = markers();
    const whole = {
      ".": { keel: "./src/index.ts", default: "./index.js" },
      "./*": { keel: "./src/*.ts", default: EVIL },
    };
    const dir = materialize(project(null, m.marker, "./tokens", whole, m.rootMarker));
    made.push(dir);
    const check = keel(dir, ["check"]);
    const found = diags(check, "E1815");
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toBe('@acme/ui exports "./*" matches "./tokens"; give it an entry');
    expect(check.status).not.toBe(0);
    const build = keel(dir, ["build"]);
    expect(diags(build, "E1815")).toHaveLength(1);
    expect(build.status).not.toBe(0);
    noMarkers(m, "keel check and keel build");
  },
  SLOW * 2,
);

test(
  "with `keel` first in `./tokens`, `keel check` reports no E1815 and `evil.js` is not the file `tokens.ts` resolves to",
  () => {
    const m = markers();
    const dir = materialize(project({ keel: SRC, default: "./evil.js" }, m.marker));
    made.push(dir);
    const run = keel(dir, ["check"]);
    expect(diags(run, "E1815")).toEqual([]);
    expect(existsSync(m.marker)).toBe(false);
    rmSync(m.folder, { recursive: true, force: true });
  },
  SLOW,
);
