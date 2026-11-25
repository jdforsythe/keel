// k.library Ids: E1161 accepts only an `id` check can show is built from the component's `id` prop. What it cannot read
// is E1161; the stdlib's own widgets, read as library files, use only accepted forms.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { expect, it } from "vitest";
import { check } from "../src/index.ts";

const LIB = "node_modules/@acme/charts";
const manifest = (id: string, deps: string[]) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps).replaceAll('"', "'")}, capabilities: [], public: { exports: [] } })\n`;
const base = [
  { path: "modules/shop/module.ts", source: manifest("shop", ["@acme/charts"]) },
  {
    path: `${LIB}/package.json`,
    source: JSON.stringify({ name: "@acme/charts", version: "1.0.0", type: "module", keel: "library" }),
  },
  { path: `${LIB}/module.ts`, source: manifest("charts", []) },
];
const UI = "import { Box } from '@keel/ui'\nimport { Part } from '@keel/ui/aria'\n";
const e1161 = (files: { path: string; source: string }[]) =>
  check([...base, ...files], { types: false }).diagnostics.filter((d) => d.code === "E1161");
const inLibrary = (body: string, head = "") => [
  {
    path: `${LIB}/src/Badge.tsx`,
    source: `${UI}${head}export default function Badge(props: { id: string; n: number }) {\n  return ${body}\n}\n`,
  },
];

const BAD: ReadonlyArray<readonly [string, string, string?]> = [
  ["a spread with no id", "<Box {...{ id: 'box' }} />"],
  ["a spread after the id", "<Box id={`${props.id}.box`} {...{ id: 'box' }} />"],
  ["a call whose argument is a name", "Box(args)", "const args = { id: 'box' }\n"],
  ["a call whose object spreads after the id", "Box({ id: `${props.id}.box`, ...{ id: 'box' } })"],
  ["a string concatenation", "<Box id={'a' + 'b'} />"],
  ["a concatenation with the prop", "<Box id={props.id + '.box'} />"],
  ["a template with no id part", "<Box id={`${props.n}.box`} />"],
  ["a const bound to a literal", "<Box id={fixed} />", "const fixed = 'box'\n"],
  ["a Part call with no id", "Part({ role: 'generic' })"],
];
for (const [what, body, head] of BAD)
  it(`E1161: ${what} in a library file is one E1161`, () => {
    expect(e1161(inLibrary(body, head)).length).toBe(1);
  });

/** Helpers of the library file the call cases use. */
const HELPERS =
  "const part = (id: string, k: string) => `${id}.${k}`\nconst same = (x: string) => x\nconst rec = (k: string): string => rec(k)\n";

const CALLS_BAD: ReadonlyArray<readonly [string, string]> = [
  ["a global's call", "<Box id={String('box')} />"],
  ["an immediately invoked function returning a literal", "<Box id={(() => 'box')()} />"],
  ["a helper returning its argument, given a literal", "<Box id={same('box')} />"],
  ["a file's helper given a literal for the id", "<Box id={part('a', 'box')} />"],
  ["a recursive helper (not read again while its read is open)", "<Box id={rec('box')} />"],
  ["a call of a parameter", "<Box id={((f: () => string) => f())(() => 'box')} />"],
  ["a computed member's call", "<Box id={helpers['part'](props.id, 'x')} />"],
];
for (const [what, body] of CALLS_BAD)
  it(`E1161: ${what} is one E1161`, () => {
    expect(e1161(inLibrary(body, `${HELPERS}const helpers = { part }\n`)).length).toBe(1);
  });

it("E1161: an import from a package that is no library is not read: its call is one E1161", () => {
  const files = [
    { path: "node_modules/left-pad/package.json", source: JSON.stringify({ name: "left-pad", version: "1.0.0" }) },
    { path: "node_modules/left-pad/index.ts", source: "export const pad = (id: string) => id\n" },
    ...inLibrary("<Box id={pad(props.id)} />", "import { pad } from 'left-pad'\n"),
  ];
  expect(e1161(files).length).toBe(1);
});

it("E1161: a helper reached through a re-export of the library's own files is read", () => {
  const files = [
    {
      path: `${LIB}/src/ids.ts`,
      source: "export const part = (id: string, k: string) => `${id}.${k}`\nexport const lit = (k: string) => k\n",
    },
    { path: `${LIB}/src/helpers.ts`, source: "export { part, lit } from './ids.ts'\n" },
  ];
  const head = "import { part, lit } from './helpers.ts'\n";
  expect(e1161([...files, ...inLibrary("<Box id={part(props.id, 'box')} />", head)])).toEqual([]);
  expect(e1161([...files, ...inLibrary("<Box id={lit('box')} />", head)]).length).toBe(1);
});

it("E1161: a helper from another library, through its exports, is read; a member of an object a helper returns too", () => {
  const other = [
    {
      path: "node_modules/@acme/other/package.json",
      source: JSON.stringify({
        name: "@acme/other",
        version: "1.0.0",
        type: "module",
        keel: "library",
        exports: { ".": { keel: "./src/index.ts", default: "./index.js" } },
      }),
    },
    { path: "node_modules/@acme/other/module.ts", source: manifest("other", []) },
    {
      path: "node_modules/@acme/other/src/index.ts",
      source:
        "export const chart = (id: string) => {\n  const partId = (k: string) => `${id}.${k}`\n  return { partId }\n}\nexport const fixed = () => ({ partId: (k: string) => k })\n",
    },
  ];
  const head = "import { chart, fixed } from '@acme/other'\n";
  const run = (body: string) =>
    check([...base, ...other, ...inLibrary(body, head)], { types: false }).diagnostics.filter(
      (d) => d.code === "E1161",
    );
  expect(run("(() => { const l = chart(props.id); return <Box id={l.partId('box')} /> })()")).toEqual([]);
  expect(run("(() => { const l = fixed(); return <Box id={l.partId('box')} /> })()").length).toBe(1);
});

const GOOD: ReadonlyArray<readonly [string, string]> = [
  ["a template with props.id", "<Box id={`${props.id}.box`} />"],
  ["a spread before a built id", "<Box {...{ p: '2' }} id={`${props.id}.box`} />"],
  ["a const read from props.id", "(() => { const id = props.id; return <Box id={`${id}.box`} /> })()"],
  ["a destructured id", "(() => { const { id } = props; return Part({ id: `${id}.box`, role: 'generic' }) })()"],
  [
    "a const built from the id",
    "(() => { const id = props.id; const part = `${id}.toast`; return Part({ id: part }) })()",
  ],
  [
    "a closure in the component that builds on props.id",
    "(() => { const partId = (k: string) => `${props.id}.${k}`; return <Box id={partId('box')} /> })()",
  ],
  ["a file's helper given props.id", "<Box id={part(props.id, 'box')} />"],
  ["a helper returning its argument, given props.id", "<Box id={same(props.id)} />"],
  ["a conditional of two built ids", "<Box id={props.n > 0 ? `${props.id}.a` : `${props.id}.b`} />"],
];
for (const [what, body] of GOOD)
  it(`E1161: ${what} is no E1161`, () => {
    expect(e1161(inLibrary(body, HELPERS))).toEqual([]);
  });

it("E1161: a template is accepted exactly when one of its expressions is built from the prop", () => {
  fc.assert(
    fc.property(fc.array(fc.constantFrom("props.id", "props.n", "'x'"), { minLength: 0, maxLength: 3 }), (parts) => {
      const tpl = `\`${parts.map((p) => `\${${p}}`).join(".")}.box\``;
      expect(e1161(inLibrary(`<Box id={${tpl}} />`)).length).toBe(parts.includes("props.id") ? 0 : 1);
    }),
    { seed: 1337, numRuns: 40 },
  );
});

/** Every source file under `dir`, relative to it. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(dir, e.name)).map((f) => `${e.name}/${f}`) : /\.tsx?$/.test(e.name) ? [e.name] : [],
  );
}

/**
 * The stdlib's elements E1161 reports today: each a wrapping `Box` or `Text` called with no `id` at all, which slice 4
 * gives `id: \`${id}.<part>\``; no stdlib `id` form is refused.
 */
const NO_ID: Readonly<Record<string, readonly string[]>> = {
  "std-headless": [
    "Combobox.ts:60",
    "Combobox.ts:120",
    "Dialog.ts:58",
    "Disclosure.ts:25",
    "Menu.ts:54",
    "Tabs.ts:44",
    "Toaster.ts:130",
    "internal/content.ts:23",
  ],
  "std-tables": [],
};

it("the stdlib's widgets (std-headless, std-tables), read as a library's files, use only accepted id forms", () => {
  for (const pkg of ["std-headless", "std-tables"]) {
    const dir = fileURLToPath(new URL(`../../${pkg}/src/`, import.meta.url));
    const files = sources(dir).map((f) => ({
      path: `${LIB}/src/${relative(dir, join(dir, f)).split("\\").join("/")}`,
      source: readFileSync(join(dir, f), "utf8"),
    }));
    expect(files.length, pkg).toBeGreaterThan(0);
    const found = e1161(files).map((d) => `${d.path.slice(`${LIB}/src/`.length)}:${d.line}`);
    expect(found, pkg).toEqual(NO_ID[pkg]);
    for (const at of found) {
      const [file = "", line = "0"] = at.split(":");
      const text = files.find((f) => f.path === `${LIB}/src/${file}`)?.source.split("\n")[Number(line) - 1] ?? "";
      expect(text, at).toMatch(/\b(?:Box|Text)\(\{ ?(?!.*\bid\b)/);
    }
  }
});
