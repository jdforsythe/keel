// Shared fixture for the k.compat Sources conformance files (not a test file). Public surface only: the `keel` binary over a temp project.
// Seed 1337 for every property in this suite.
// ASSUMED (spec names no fixture layout; the layout is what `keel build` accepts today): the files other than `modules/y/subject.ts` sit where the
// one-export-per-file and no-lowercase-JSX rules (E1752, E1805) do not reach: `modules/y/View.tsx` (`Box` stands for the `p` of the spec text: a lowercase element is E1805 in every app file), a node_modules package `xs` for the multi-export imports.
// `routes.ts` imports `unsafe/Doc.ts` first (a document stub) because the JSX of a `.tsx` file needs a DOM when evaluated in Node.
// ASSUMED: the shared two-module project of compat-support.ts, whose `routes.ts` also imports
// `subject.ts` and `unsafe/View.tsx`, so both are evaluated by `keel build` and listed in `sources`; the edits are applied to the
// subject alone, after one build, and `keel check` reads the stale surface (no rebuild between).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Run, type Tree, diags, keel, materialize, project, readText, write } from "./compat-support.ts";

export const SUBJECT = "modules/y/subject.ts";
export const VIEW = "modules/y/View.tsx";
export const SURFACE = ".keel/surface.json";
export const SLOW = 600_000;

/** The listed `.ts` file every #12 and #13 edit starts from. */
export const SUBJECT_TEXT = [
  "import { a } from 'xs'",
  "import { b } from 'xs'",
  "import { d, e } from 'xs'",
  "import { c } from './c.ts'",
  "import './p.ts'",
  "import './q.ts'",
  "const k = 'k'",
  "const esc = 'A'",
  "const o = {",
  "  first: 1,",
  "  'k': 1,",
  "  last: [1, 2]",
  "}",
  "const n = a + b;",
  "const big = 1000",
  "const re = /ab/gi",
  "const t: string = 'v'",
  "const tpl = `a${c}b`",
  "type Shape = { p: string; q: number }",
  "type U = 'a' | 'b'",
  "const s1 = 1;",
  "const s2 = 2;",
  "const u: U = 'a'",
  "const sh: Shape = { p: 'p', q: 1 }",
  "export const subject = { k, esc, o, n, big, re, t, tpl, d, e, s1, s2, u, sh }",
  "",
].join("\n");

export const VIEW_TEXT =
  "import { Box } from '@keel/ui'\nexport default function View() {\n  return <Box>Hi there</Box>\n}\n";

/** Stands in for the DOM the JSX templates of `View.tsx` touch when `keel build` evaluates the file in Node. */
const DOC_STUB = [
  "const stub: object = new Proxy(function () {}, {",
  '  get: (_t, key) => (key === "length" || key === "childElementCount" || key === "nodeType" ? 1 : stub),',
  "  apply: () => stub,",
  "})",
  'Reflect.set(globalThis, "document", stub)',
  "",
].join("\n");

export function tree(subject: string = SUBJECT_TEXT, view: string = VIEW_TEXT): Tree {
  const files = project();
  const routes = files["modules/y/routes.ts"] ?? "";
  return {
    ...files,
    "modules/y/routes.ts": `import '../../unsafe/Doc.ts'\nimport './subject.ts'\nimport './View.tsx'\n${routes}`,
    [SUBJECT]: subject,
    [VIEW]: view,
    "node_modules/xs/package.json": '{ "name": "xs", "type": "module", "main": "index.js", "types": "index.d.ts" }\n',
    "node_modules/xs/index.d.ts":
      "export const a: number\nexport const b: number\nexport const d: number\nexport const e: number\n",
    "node_modules/xs/index.js": "export const a = 1\nexport const b = 2\nexport const d = 3\nexport const e = 4\n",
    "modules/y/c.ts": "export const c = 'c'\n",
    "unsafe/Doc.ts": DOC_STUB,
    "modules/y/p.ts": "export {}\n",
    "modules/y/q.ts": "export {}\n",
    "tsconfig.json": `${JSON.stringify(
      {
        extends: "@keel/compiler/tsconfig.strict.json",
        compilerOptions: { jsxImportSource: "@keel/runtime-dom" },
        include: ["modules"],
      },
      null,
      2,
    )}\n`,
  };
}

/** A built project and its recorded surface text. */
export function built(subject?: string, view?: string): { dir: string; surface: string } {
  const dir = materialize(tree(subject, view));
  const run = keel(dir, ["build"]);
  if (run.status !== 0) throw new Error(`keel build exited ${String(run.status)}`);
  return { dir, surface: readText(dir, SURFACE) };
}

/** Every E1005 of a run, whichever artifact it names. */
export const stale = (run: Run): Run["records"] => diags(run, "E1005");
/** The E1005 records on `.keel/surface.json`. */
export const staleSurface = (run: Run): Run["records"] =>
  stale(run).filter((r) => String(r.path).endsWith("surface.json"));
export const surfaceText = (dir: string): string => readFileSync(join(dir, SURFACE), "utf8");
export { write };

/** `src` with `from` replaced by `to`; throws when `from` is absent (the fixture and the edit disagree). */
export function sub(src: string, from: string, to: string): string {
  if (!src.includes(from)) throw new Error(`fixture text missing: ${from}`);
  return src.replace(from, () => to);
}
/** As `sub`, but a no-op when `from` is absent (an earlier edit already rewrote it). */
export const subIf = (src: string, from: string, to: string): string =>
  src.includes(from) ? src.replace(from, () => to) : src;

const C_IMPORT = "import { c } from './c.ts'\n";

/** `last` edits rewrite every line, so a composition applies them after the others. */
export type Edit = { name: string; apply: (src: string) => string; last?: true };

/** The #12 edits: each leaves the normal form of the subject unchanged. `lax` makes a miss a no-op (compositions). */
export function formatterEdits(lax: boolean, numberSpelling = "1_000"): Edit[] {
  const s = lax ? subIf : sub;
  const lines = (src: string): string[] => src.split("\n");
  return [
    {
      name: "swapping two import declarations that bind names",
      apply: (src) =>
        s(src, "import { a } from 'xs'\nimport { b } from 'xs'\n", "import { b } from 'xs'\nimport { a } from 'xs'\n"),
    },
    {
      name: "a binding import moved past the side-effect imports",
      apply: (src) =>
        lax && !src.includes(C_IMPORT)
          ? src
          : sub(sub(src, C_IMPORT, ""), "import './q.ts'\n", `import './q.ts'\n${C_IMPORT}`),
    },
    {
      name: "import { a } and import { b } from one source merged as import { b, a }",
      apply: (src) => s(src, "import { a } from 'xs'\nimport { b } from 'xs'\n", "import { b, a } from 'xs'\n"),
    },
    { name: "specifier order", apply: (src) => s(src, "import { d, e }", "import { e, d }") },
    {
      name: "an import moved to the end of the file",
      apply: (src) => (lax && !src.includes(C_IMPORT) ? src : `${sub(src, C_IMPORT, "")}${C_IMPORT}`),
    },
    {
      name: "adding a line comment and a block comment",
      apply: (src) =>
        `// leading\n${s(src, "const n = a + b;", "/* inline */ const n = a + b; // trailing")}\n/* end */\n`,
    },
    {
      name: "re-indenting every line",
      last: true,
      apply: (src) =>
        lines(src)
          .map((l) => (l.trim() === "" ? l : `      ${l.trimStart()}`))
          .join("\n"),
    },
    { name: "\\r\\n line endings", last: true, apply: (src) => src.replaceAll("\n", "\r\n") },
    { name: "a leading byte order mark", last: true, apply: (src) => `\uFEFF${src}` },
    { name: "writing a string 'k' as \"k\"", apply: (src) => s(src, "const k = 'k'", 'const k = "k"') },
    {
      name: "a string written with an escape",
      apply: (src) => s(src, "const esc = 'A'", "const esc = '\\x41'"),
    },
    {
      name: "a trailing comma on a multi-line object literal",
      apply: (src) => s(src, "last: [1, 2]\n}", "last: [1, 2],\n}"),
    },
    {
      name: "removing the semicolon that ends a const statement followed by a const line",
      apply: (src) => s(src, "const s1 = 1;\nconst s2", "const s1 = 1\nconst s2"),
    },
    { name: "const n = (a + b);", apply: (src) => s(src, "const n = a + b;", "const n = (a + b);") },
    { name: "the key 'k': 1 written k: 1", apply: (src) => s(src, "'k': 1", "k: 1") },
    {
      name: `1000 written ${numberSpelling}`,
      apply: (src) => s(src, "const big = 1000", `const big = ${numberSpelling}`),
    },
    { name: "regular expression flags in another order", apply: (src) => s(src, "/ab/gi", "/ab/ig") },
    {
      name: "type literal members separated by commas",
      apply: (src) => s(src, "{ p: string; q: number }", "{ p: string, q: number }"),
    },
    { name: "a union with a leading |", apply: (src) => s(src, "= 'a' | 'b'", "= | 'a' | 'b'") },
  ];
}

/** The #13 edits: each changes the normal form of the subject. `file` edits replace or remove the whole file. */
export type Change = { name: string; apply: (src: string) => string; file?: "delete" | "unparsable" };
export function changes(value = "j"): Change[] {
  return [
    {
      name: "changing a string literal's value",
      apply: (src) => sub(src, "const k = 'k'", `const k = '${value}'`),
    },
    {
      name: "swapping two properties of an object literal",
      apply: (src) => sub(src, "  first: 1,\n  'k': 1,\n", "  'k': 1,\n  first: 1,\n"),
    },
    {
      name: "swapping two statements that are not import declarations",
      apply: (src) => sub(src, "const s1 = 1;\nconst s2 = 2;\n", "const s2 = 2;\nconst s1 = 1;\n"),
    },
    {
      name: "import { a } becoming import { a as aa } with each use renamed",
      apply: (src) =>
        sub(
          sub(src, "import { a } from 'xs'", "import { a as aa } from 'xs'"),
          "const n = a + b;",
          "const n = aa + b;",
        ),
    },
    { name: "removing an import declaration", apply: (src) => sub(src, "import { b } from 'xs'\n", "") },
    {
      name: "swapping import './p.ts' and import './q.ts'",
      apply: (src) => sub(src, "import './p.ts'\nimport './q.ts'\n", "import './q.ts'\nimport './p.ts'\n"),
    },
    { name: "changing a type annotation from string to number", apply: (src) => sub(src, "t: string", "t: number") },
    { name: "deleting the file", apply: (src) => src, file: "delete" },
    { name: "a syntax error in the file", apply: (src) => `${src}\nexport const = ;\n`, file: "unparsable" },
  ];
}
