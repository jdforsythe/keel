// k.library the clauses on `check()` reading a library's files, each quoted whole (the project of the first clause: `modules/shop/module.ts` lists `'@acme/charts'`, `node_modules/@acme/charts/` holds the library, `modules/shop/Page.tsx` renders `<Badge id="shop.badge" />`)
// Spec: k.library, clause "In that project, `<box />` in `src/Badge.tsx` is one E1805 in the app's `keel check`, at `node_modules/@acme/charts/src/Badge.tsx`, with no `fix`."
// Spec: k.library, clause "In that project, `<Box />`, `<Box id=\"box\" />`, `<Box id={`box`} />` and `Box({})` in `src/Badge.tsx` are each one E1161; `<Box id={`${props.id}.box`} />` and `<Box id={partId('box')} />`, `partId` the closure ``(k) => `${props.id}.${k}` ``, are not; with `partId` `(k) => k`, it is one E1161."
// Spec: k.library, clause "In that project, a cast `x as string` in `src/Badge.tsx` is one E1757 at `node_modules/@acme/charts/src/Badge.tsx`, and an import of `@keel/store/internal` there is one E1576."
// Spec: k.library, clause "In that project, `import x from '../../outside.ts'` in `src/Badge.tsx` is one E1163 at the specifier."
// Rules: "E1161 an element in a library file whose `id` Ids does not accept (fix: none)"
// Rules: "E1163 a library file whose relative import, re-export or literal `import()` resolves outside its package folder, at the specifier, or a library manifest `deps` entry that does not begin with `@`, at the entry (fix: none; the entry names no module, so it is no E1153 edge and no E1165)" (the manifest half is in library-manifest.test.ts)
// Spec text (k.a11y-static): "**Library contrast.** In an app, an E1804 at an element of a library file, or at a library look (a key of the `look` group alone, whatever other groups hold the same name), is reported in `tokens.ts` and not at the library's file: at the opening quote of the app's key for its `fg` when the app writes one, else for its `bg`, else at the spread `...<id>Tokens.color`, else line 1, column 1; once per pair and scheme however many elements and looks hold it; message `<fg> on <bg> is <ratio>:1 in <scheme>, needs <need>:1; override in tokens.ts`."
// In an app: "`keel check` runs every rule but E1106 (k.formats Who declares) over them, the type pass included, against the app's `tokens.ts`, kernel packages and `topology.ts`. Where a section reads app code or `modules/<id>/` (k.check App code, k.boundary Reach), it reads a library's file `<f>` as `modules/<id>/<f>`, its `unsafe/` files with their lifted ranges. A diagnostic in one is the app's, at `node_modules/<name>/<f>`, with no `fix`; nothing turns a rule off there. A bare import there resolves from the library's folder, to one of its `dependencies`, and is no E1163."
// Ids: "**Ids.** Each `@keel/ui` base element (k.ui, `Host` among them) and `@keel/ui/aria` `Part` a library file renders, as JSX or a call, takes an `id` check reads as built from its component's `id` prop (`<id>.<part>`, k.component IDs; a derived id holds the file's path, which changes with the installer): `<p>.id`, `<p>` a top-level function's first parameter; a name bound to such a value or destructured as `id`; a template literal with one; a conditional of two; a call whose callee check reads (a function of the library's or another library's files, a closure, a member of an object it reads back to a literal or a call) and whose every returned expression is one, parameters standing for the arguments and closure names read where bound (a function met again while its read is open, or past eight calls, is not read); or such an `id` in an object literal, spread or not, no later unreadable spread follows. Anything else is E1161: none, a literal, a concatenation, a call of a global, a parameter or a package that is no library."
// Seed 1337
// A call is read through its callee (function, closure or object member), parameters standing for the arguments; the generated accepted trees call a readable identity helper `ident`, the dropped-id mutation gives one E1161.
// ASSUMPTIONS (spec silent): `check()` is given the library's files at `node_modules/<name>/...` with its `package.json`, `module.ts` and ledger file, as library-manifest.test.ts does; "at the specifier" is the
// specifier's line and a column from its opening quote to its closing one. A library file reads as `modules/charts/<f>` ("it reads a library's file `<f>` as it reads `modules/<id>/<f>`"): the by-code table's one-file fixtures
// (a fixture of one source file, its `modules/<x>/module.ts` manifest aside) are placed at `src/<basename>` in the library and, as the control, at `modules/charts/src/<basename>` in an app with the same other files.
// `Part` is imported from `@keel/ui/aria`. Of a bare import's package, `check()` reads no disk: the cases here assert only that no E1163 is reported and what an app file would be refused for (library-imports.test.ts in the cli
// package builds one with its package installed). The by-code E1161 and E1163 fixtures are the library-only rules (k.library Rules), E1162 and E1166 too: the one-file property allows them as extras in a library.
import path from "node:path";
import { check } from "@keel/check";
import { repoRoot } from "@keel/tooling/repo-root";
import fc from "fast-check";
import { expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { CODE_FIXTURES } from "./fixtures-by-code.ts";
import { atText } from "./library-looks-support.ts";
import { type Files, SEED, manifestFile } from "./module-support.ts";

const NO_TYPES = { types: false } as const;
const NAME = "@acme/charts";
const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;
const UI = "import { Box } from '@keel/ui'\n";
const badge = (body: string, head = UI): string =>
  `${head}export default function Badge(props: { id: string }) {\n  return ${body}\n}\n`;

/** The project of the first clause: the app's `shop` and the library `name` (id `id`), whose files `extra` adds to or replaces by path. */
function project(extra: Files = [], name = NAME, id = "charts"): Files {
  const root = `node_modules/${name}`;
  const base: Files = [
    manifestFile({ id: "shop", deps: [name] }),
    {
      path: "modules/shop/Page.tsx",
      source: `import { Badge } from '${name}'\nexport default function Page() { return <Badge id="shop.badge" /> }\n`,
    },
    {
      path: `${root}/package.json`,
      source: JSON.stringify({
        name,
        version: "1.0.0",
        type: "module",
        keel: "library",
        exports: { ".": { keel: "./src/index.ts", default: "./index.js" } },
      }),
    },
    { path: `${root}/index.js`, source: "export {}\n" },
    manifestFile({ id, deps: [], exports: ["Badge"] }, root),
    { path: `${root}/src/index.ts`, source: "export { default as Badge } from './Badge.tsx'\n" },
    { path: `${root}/src/Badge.tsx`, source: badge("<Box id={`${props.id}.box`} />") },
    { path: `${root}/.keel/ledger.json`, source: LEDGER },
  ];
  const own = new Set(extra.map((x) => x.path));
  return [...base.filter((b) => !own.has(b.path)), ...extra];
}
const lib = (rel: string, source: string, name = NAME) => ({ path: `node_modules/${name}/${rel}`, source });
const inBadge = (source: string) => project([lib("src/Badge.tsx", source)]);
const hitsOf = (files: Files, code: string, opts: Parameters<typeof check>[1] = NO_TYPES) =>
  check(files, opts).diagnostics.filter((d) => d.code === code);

const scoped = fc
  .tuple(fc.stringMatching(/^[a-z]{4,8}$/), fc.stringMatching(/^[a-z]{4,8}$/))
  .map(([a, b]) => `@${a}/${b}`);

test(
  "In that project, `check()` reports no diagnostic",
  () => {
    expect(check(project(), { ...NO_TYPES, artifacts: { tokens: { space: { 2: "8px" } } } }).diagnostics).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test(
  "In that project, `<box />` in `src/Badge.tsx` is one E1805 in the app's `keel check`, at `node_modules/@acme/charts/src/Badge.tsx`, with no `fix`",
  () => {
    const d = hitsOf(inBadge(badge("<box />")), "E1805");
    expect(d.length).toBe(1);
    expect(d[0]?.path).toBe("node_modules/@acme/charts/src/Badge.tsx");
    expect(d[0]?.fix).toBeUndefined();
  },
  CHECK_CASE_BOUND,
);

test(
  "E1805 in a library file is located at `node_modules/<name>/<f>` and carries no fix, whatever the package name and the file",
  () => {
    fc.assert(
      fc.property(scoped, fc.constantFrom("src/Badge.tsx", "src/Deep.tsx"), (name, file) => {
        const files = project([lib(file, badge("<box />"), name)], name, "pkg");
        const d = hitsOf(files, "E1805");
        expect(d.length).toBe(1);
        expect(d[0]?.path).toBe(`node_modules/${name}/${file}`);
        expect(d[0]?.fix).toBeUndefined();
      }),
      { seed: SEED, numRuns: 20 },
    );
  },
  CHECK_CASE_BOUND,
);

test(
  "a library file under `unsafe/` is read with its lifted ranges: E1805 there is reported at the library's path",
  () => {
    const files = project([lib("unsafe/Raw.tsx", badge("<box />"))]);
    const d = hitsOf(files, "E1805");
    expect(d.map((x) => x.path)).toEqual(["node_modules/@acme/charts/unsafe/Raw.tsx"]);
  },
  CHECK_CASE_BOUND,
);

const E1161_BAD: ReadonlyArray<readonly [string, string]> = [
  ["<Box />", badge("<Box />")],
  ['<Box id="box" />', badge('<Box id="box" />')],
  ["<Box id={`box`} />", badge("<Box id={`box`} />")],
  ["Box({})", badge("Box({})")],
];
for (const [what, source] of E1161_BAD) {
  test(
    `In that project, \`${what}\` in \`src/Badge.tsx\` is one E1161, at the library's path, with no fix`,
    () => {
      const d = hitsOf(inBadge(source), "E1161");
      expect(d.length).toBe(1);
      expect(d[0]?.path).toBe("node_modules/@acme/charts/src/Badge.tsx");
      expect(d[0]?.fix).toBeUndefined();
    },
    CHECK_CASE_BOUND,
  );
}

test(
  "In that project, `<Box id={`${props.id}.box`} />` in `src/Badge.tsx` is no E1161",
  () => {
    expect(hitsOf(inBadge(badge("<Box id={`${props.id}.box`} />")), "E1161")).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

const CLOSURE = "const partId = (k: string): string => `${props.id}.${k}`\n";
const inComponent = (before: string, ret: string): string =>
  `${UI}export default function Badge(props: { id: string }) {\n  ${before}return ${ret}\n}\n`;

test(
  "In that project, `<Box id={partId('box')} />`, `partId` the closure `(k) => `${props.id}.${k}``, in `src/Badge.tsx` is no E1161",
  () => {
    expect(hitsOf(inBadge(inComponent(`${CLOSURE}  `, "<Box id={partId('box')} />")), "E1161")).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test(
  "In that project, with `partId` `(k) => k`, `<Box id={partId('box')} />` is one E1161; given `props.id` it is none",
  () => {
    const ident = "const partId = (k: string): string => k\n  ";
    expect(hitsOf(inBadge(inComponent(ident, "<Box id={partId('box')} />")), "E1161").length).toBe(1);
    expect(hitsOf(inBadge(inComponent(ident, "<Box id={partId(props.id)} />")), "E1161")).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test(
  "E1161: an element whose `id` is a string literal or a template literal without an expression is one E1161 per element, whatever the text; one built from `props.id` is none",
  () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{1,8}(\.[a-z]{1,8}){0,2}$/),
        fc.constantFrom("string", "template", "built"),
        (text, form) => {
          const id =
            form === "string" ? `"${text}"` : form === "template" ? `{\`${text}\`}` : `{\`\${props.id}.${text}\`}`;
          const d = hitsOf(inBadge(badge(`<Box id=${id} />`)), "E1161");
          expect(d.length).toBe(form === "built" ? 0 : 1);
          for (const x of d) expect(x.path).toBe("node_modules/@acme/charts/src/Badge.tsx");
        },
      ),
      { seed: SEED, numRuns: 30 },
    );
  },
  CHECK_CASE_BOUND,
);

test(
  "E1161: a `Host` in a library file with no `id`, or a literal one, is one E1161; one built from `props.id` is none",
  () => {
    const host = (id: string) =>
      `import { Host } from '@keel/ui'\nimport { s } from '@keel/schema'\nconst In = s.object({ n: s.number() })\nexport default function Badge(props: { id: string }) {\n  return <Host ${id} role="img" label="Chart" input={In} value={{ n: 1 }} code={() => import('./chart.ts').then((m) => m.chart)} />\n}\n`;
    expect(hitsOf(inBadge(host("")), "E1161").length).toBe(1);
    expect(hitsOf(inBadge(host('id="chart"')), "E1161").length).toBe(1);
    expect(hitsOf(inBadge(host("id={`${props.id}.chart`}")), "E1161")).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

const PART = "import { Part } from '@keel/ui/aria'\n";
const partIn = (body: string): string =>
  `${PART}export default function Badge(props: { id: string }) {\n  return ${body}\n}\n`;

test(
  "E1161: a `Part` from `@keel/ui/aria` with no `id`, a string literal, a template literal without an expression, or called with a literal `id` is one E1161; one built from `props.id` is none",
  () => {
    for (const body of ["<Part />", '<Part id="box" />', "<Part id={`box`} />", "Part({ id: 'box' })"]) {
      const d = hitsOf(inBadge(partIn(body)), "E1161");
      expect(d.length, body).toBe(1);
      expect(d[0]?.path, body).toBe("node_modules/@acme/charts/src/Badge.tsx");
      expect(d[0]?.fix, body).toBeUndefined();
    }
    expect(hitsOf(inBadge(partIn("<Part id={`${props.id}.box`} />")), "E1161")).toEqual([]);
    expect(hitsOf(inBadge(partIn("Part({ id: `${props.id}.box` })")), "E1161")).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test(
  "E1161: each `@keel/ui` base element (`Host` among them), as JSX or as a call, with a literal `id` is one E1161",
  () => {
    const BASES = [
      "Box",
      "Text",
      "Button",
      "Checkbox",
      "Heading",
      "Frame",
      "Host",
      "Image",
      "Input",
      "Link",
      "Select",
      "TextArea",
    ];
    fc.assert(
      fc.property(fc.constantFrom(...BASES), fc.constantFrom("jsx", "call"), (el, form) => {
        const lit = form === "jsx" ? `<${el} id="x" />` : `${el}({ id: 'x' })`;
        const src = `import { ${el} } from '@keel/ui'\nexport default function Badge(props: { id: string }) {\n  return ${lit}\n}\n`;
        expect(hitsOf(inBadge(src), "E1161").length, lit).toBe(1);
      }),
      { seed: SEED, numRuns: 48 },
    );
  },
  CHECK_CASE_BOUND,
);

test(
  "E1161: an element with a spread and an `id` is judged by that `id`: a literal one is one E1161, a string literal in braces too",
  () => {
    expect(hitsOf(inBadge(badge('<Box {...props} id="box" />')), "E1161").length).toBe(1);
    expect(hitsOf(inBadge(badge("<Box id={'box'} />")), "E1161").length).toBe(1);
    expect(hitsOf(inBadge(badge("<Box {...props} id={`${props.id}.box`} />")), "E1161")).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

type El = { readonly name: string; readonly from: string };
const ELS: readonly El[] = [
  { name: "Box", from: "@keel/ui" },
  { name: "Host", from: "@keel/ui" },
  { name: "Part", from: "@keel/ui/aria" },
];
type Attr = { readonly kind: "id" | "spread"; readonly expr: string };
const id = (expr: string): Attr => ({ kind: "id", expr });
const spread = (expr: string): Attr => ({ kind: "spread", expr });
const PART_ID = "const ident = (k: string): string => k\n";
const closure = (p: string): string => `const partId = (k: string): string => \`\${${p}.id}.\${k}\``;
/** A library file rendering `el` as JSX or a call over `attrs`, inside a function whose first parameter is `p`, after the lines `pre`. */
function renderEl(el: El, form: "jsx" | "call", p: string, pre: readonly string[], attrs: readonly Attr[]): string {
  const use =
    form === "jsx"
      ? `<${el.name} ${attrs.map((a) => (a.kind === "id" ? `id={${a.expr}}` : `{...${a.expr}}`)).join(" ")} />`
      : `${el.name}({ ${attrs.map((a) => (a.kind === "id" ? `id: ${a.expr}` : `...${a.expr}`)).join(", ")} })`;
  return `import { ${el.name} } from '${el.from}'\n${PART_ID}export default function Badge(${p}: { id: string; name: string }) {\n${pre.map((l) => `  ${l}\n`).join("")}  return ${use}\n}\n`;
}
const tpl = (e: string): string => `\`\${${e}}.part\``;

type IdCase = { readonly what: string; readonly pre: (p: string) => string[]; readonly attrs: (p: string) => Attr[] };
const ACCEPTED: readonly IdCase[] = [
  { what: "`<p>.id`", pre: () => [], attrs: (p) => [id(`${p}.id`)] },
  { what: "a `const` bound to `<p>.id`", pre: (p) => [`const own = ${p}.id`], attrs: () => [id("own")] },
  { what: "a `const` destructured as `id`", pre: (p) => [`const { id } = ${p}`], attrs: () => [id("id")] },
  { what: "a template literal with `<p>.id`", pre: () => [], attrs: (p) => [id(tpl(`${p}.id`))] },
  {
    what: "a `const` of a template literal with `<p>.id`",
    pre: (p) => [`const k = ${tpl(`${p}.id`)}`],
    attrs: () => [id("k")],
  },
  {
    what: "a conditional of `<p>.id` and a template literal with it",
    pre: () => [],
    attrs: (p) => [id(`${p}.name ? ${p}.id : ${tpl(`${p}.id`)}`)],
  },
  {
    what: "a `const` of a conditional of those",
    pre: (p) => [`const k = ${p}.name ? ${p}.id : ${tpl(`${p}.id`)}`],
    attrs: () => [id("k")],
  },
  {
    what: "a call `ident(key)` of the identity helper, `key` built from `<p>.id`",
    pre: (p) => [`const key = ${p}.id`],
    attrs: () => [id("ident(key)")],
  },
  {
    what: "a call `partId('box')`, `partId` the closure `(k) => `${p.id}.${k}`` declared in the function",
    pre: (p) => [closure(p)],
    attrs: () => [id("partId('box')")],
  },
  {
    what: "an `id` built from `<p>.id` after a spread check cannot read",
    pre: (p) => [`const { name, ...rest } = ${p}`, "void name"],
    attrs: (p) => [spread("rest"), id(tpl(`${p}.id`))],
  },
  { what: "an `id` built from `<p>.id` alone", pre: () => [], attrs: (p) => [id(tpl(`${p}.id`))] },
  {
    what: "a spread of a `const` object holding a correct `id`",
    pre: (p) => [`const base = { id: ${tpl(`${p}.id`)} }`],
    attrs: () => [spread("base")],
  },
  {
    what: "a correct `id` followed by a spread of a `const` object holding a correct `id`",
    pre: (p) => [`const base = { id: ${p}.id }`],
    attrs: (p) => [id(tpl(`${p}.id`)), spread("base")],
  },
];
const REJECTED: readonly IdCase[] = [
  { what: "no `id` and no spread", pre: () => [], attrs: () => [] },
  { what: "a string literal", pre: () => [], attrs: () => [id("'box'")] },
  { what: "the identity helper given a literal `ident('box')`", pre: () => [], attrs: () => [id("ident('box')")] },
  { what: "a call of an undeclared `partId('box')`", pre: () => [], attrs: () => [id("partId('box')")] },
  { what: "a template literal without an expression", pre: () => [], attrs: () => [id("`box`")] },
  { what: "a concatenation of literals `'a' + 'b'`", pre: () => [], attrs: () => [id("'a' + 'b'")] },
  { what: "a concatenation of `<p>.id` and a literal", pre: () => [], attrs: (p) => [id(`${p}.id + '.x'`)] },
  { what: "a template literal with no `id` part", pre: () => [], attrs: (p) => [id(`\`\${${p}.name}.x\``)] },
  { what: "a `const` bound to a literal", pre: () => ["const k = 'box'"], attrs: () => [id("k")] },
  { what: "a spread with no readable `id`", pre: (p) => [`const rest = { ...${p} }`], attrs: () => [spread("rest")] },
  {
    what: "a spread of an object literal holding a literal `id`",
    pre: () => [],
    attrs: () => [spread("{ id: 'box' }")],
  },
  {
    what: "an `id` built from `<p>.id` followed by a spread check cannot read",
    pre: (p) => [`const { name, ...rest } = ${p}`, "void name"],
    attrs: (p) => [id(tpl(`${p}.id`)), spread("rest")],
  },
];
const FORMS = ["jsx", "call"] as const;

test(
  "E1161: each form `Ids` lists, as JSX or as a call, for `Box`, `Host` and `Part`, is no E1161",
  () => {
    for (const el of ELS)
      for (const form of FORMS)
        for (const c of ACCEPTED) {
          const src = renderEl(el, form, "props", c.pre("props"), c.attrs("props"));
          expect(hitsOf(inBadge(src), "E1161"), `${el.name} ${form} ${c.what}`).toEqual([]);
        }
  },
  CHECK_CASE_BOUND,
);

test(
  "E1161: anything else, as JSX or as a call, for `Box`, `Host` and `Part`, is one E1161 at the library's path with no fix",
  () => {
    for (const el of ELS)
      for (const form of FORMS)
        for (const c of REJECTED) {
          const src = renderEl(el, form, "props", c.pre("props"), c.attrs("props"));
          const d = hitsOf(inBadge(src), "E1161");
          expect(d.length, `${el.name} ${form} ${c.what}`).toBe(1);
          expect(d[0]?.path).toBe("node_modules/@acme/charts/src/Badge.tsx");
          expect(d[0]?.fix).toBeUndefined();
        }
  },
  CHECK_CASE_BOUND,
);

test(
  "E1161: a call whose argument is no object literal (`Box(props)`, `Box(args)` with `args` a `const` object holding a literal `id`) is one E1161, for `Box`, `Host` and `Part`",
  () => {
    for (const el of ELS) {
      const head = `import { ${el.name} } from '${el.from}'\n`;
      const viaParam = `${head}export default function Badge(props: { id: string }) {\n  return ${el.name}(props)\n}\n`;
      const viaConst = `${head}const args = { id: 'box' }\nexport default function Badge(props: { id: string }) {\n  return ${el.name}(args)\n}\n`;
      expect(hitsOf(inBadge(viaParam), "E1161").length, `${el.name}(props)`).toBe(1);
      expect(hitsOf(inBadge(viaConst), "E1161").length, `${el.name}(args)`).toBe(1);
    }
  },
  CHECK_CASE_BOUND,
);

test(
  "E1161: a literal `id` smuggled as `<Box {...{ id: 'box' }} />` or `const args = { id: 'box' }; Box(args)` is one E1161 (no longer unjudged)",
  () => {
    const viaConst = `${UI}const args = { id: 'box' }\nexport default function Badge(props: { id: string }) {\n  return Box(args)\n}\n`;
    for (const src of [badge("<Box {...{ id: 'box' }} />"), viaConst])
      expect(hitsOf(inBadge(src), "E1161").length, src).toBe(1);
  },
  CHECK_CASE_BOUND,
);

test(
  "E1161: a spread with no `id`, `<Box {...props} />` and `Box({ ...props })`, is one E1161",
  () => {
    for (const body of ["<Box {...props} />", "Box({ ...props })"])
      expect(hitsOf(inBadge(badge(body)), "E1161").length, body).toBe(1);
  },
  CHECK_CASE_BOUND,
);

test(
  "E1161: a call of a global whose result is a literal, `id={String('box')}` and `id={(() => 'box')()}`, is one E1161 each (every returned expression must be id-built)",
  () => {
    for (const e of ["String('box')", "(() => 'box')()"])
      expect(hitsOf(inBadge(badge(`<Box id={${e}} />`)), "E1161").length, e).toBe(1);
  },
  CHECK_CASE_BOUND,
);

const OTHER = "@acme/other";
/** A second library, listed in the charts library's `deps`, whose `src/ids.ts` exports `partId`. */
const otherLibrary = (): Files => [
  manifestFile({ id: "charts", deps: [OTHER], exports: ["Badge"] }, `node_modules/${NAME}`),
  ...project([], OTHER, "other")
    .filter((x) => x.path.startsWith(`node_modules/${OTHER}/`))
    .map((x) =>
      x.path.endsWith("/module.ts")
        ? manifestFile({ id: "other", deps: [], exports: ["partId"] }, `node_modules/${OTHER}`)
        : x.path.endsWith("/src/index.ts")
          ? { path: x.path, source: "export { partId } from './ids.ts'\n" }
          : x,
    ),
  lib("src/ids.ts", "export const partId = (id: string, k: string): string => `${id}.${k}`\n", OTHER),
];
const TPL_HELPER = "const partId = (id: string, k: string): string => `${id}.${k}`\n";
type CallCase = {
  readonly what: string;
  readonly head?: string;
  readonly params?: string;
  readonly pre?: string;
  readonly expr: string;
  readonly extra?: Files;
  readonly good: boolean;
};
const CALLS: readonly CallCase[] = [
  { what: "a call of a global, `String(props.id)`", expr: "String(props.id)", good: false },
  {
    what: "a call of a global member, `Symbol.keyFor(Symbol.for('x'))`",
    expr: "Symbol.keyFor(Symbol.for('x'))",
    good: false,
  },
  {
    what: "a call of a parameter, `f('x')`",
    params: "props: { id: string }, f: (k: string) => string",
    expr: "f('x')",
    good: false,
  },
  {
    what: "a call of an import from a package that is no library",
    head: "import { make } from 'left-pad'\n",
    expr: "make(props.id)",
    good: false,
  },
  {
    what: "a helper in the library's own file that returns an id-built template",
    head: TPL_HELPER,
    expr: "partId(props.id, 'a')",
    good: true,
  },
  {
    what: "a helper in another file of the library that returns an id-built template",
    head: "import { partId } from './ids.ts'\n",
    expr: "partId(props.id, 'a')",
    extra: [lib("src/ids.ts", `export ${TPL_HELPER}`)],
    good: true,
  },
  {
    what: "a helper in another listed library",
    head: `import { partId } from '${OTHER}'\n`,
    expr: "partId(props.id, 'a')",
    extra: otherLibrary(),
    good: true,
  },
  {
    what: "the helper of another listed library given a literal",
    head: `import { partId } from '${OTHER}'\n`,
    expr: "partId('box', 'a')",
    extra: otherLibrary(),
    good: false,
  },
  {
    what: "a member of an object read back to a literal, `l.partId('a')`",
    pre: "const l = { partId: (k: string): string => `${props.id}.${k}` }\n  ",
    expr: "l.partId('a')",
    good: true,
  },
  {
    what: "a member of an object read back to a call, `const l = make(props.id)`",
    head: "const make = (id: string) => ({ partId: (k: string): string => `${id}.${k}` })\n",
    pre: "const l = make(props.id)\n  ",
    expr: "l.partId('a')",
    good: true,
  },
  {
    what: "a member of an object read back to a call, whose member returns a literal",
    head: "const make = (id: string) => ({ partId: (k: string): string => `box.${k}${id.length}` })\n",
    pre: "const l = make(props.id)\n  ",
    expr: "l.partId('a')",
    good: false,
  },
  {
    what: "a computed member, `l[name]('a')`",
    pre: "const l = { partId: (k: string): string => `${props.id}.${k}` }\n  const name = 'partId'\n  ",
    expr: "l[name]('a')",
    good: false,
  },
  {
    what: "a helper that returns an id-built value on one branch and a literal on another",
    head: "const pick = (id: string, b: boolean): string => {\n  if (b) return id\n  return 'box'\n}\n",
    expr: "pick(props.id, true)",
    good: false,
  },
  {
    what: "a recursive helper",
    head: "const rec = (id: string, n: number): string => (n === 0 ? id : rec(id, n - 1))\n",
    expr: "rec(props.id, 2)",
    good: false,
  },
];
/** A library file rendering `el` as JSX or a call over `c`. */
function callSrc(el: El, form: "jsx" | "call", c: CallCase): string {
  const use = form === "jsx" ? `<${el.name} id={${c.expr}} />` : `${el.name}({ id: ${c.expr} })`;
  return `import { ${el.name} } from '${el.from}'\n${c.head ?? ""}export default function Badge(${c.params ?? "props: { id: string }"}) {\n  ${c.pre ?? ""}return ${use}\n}\n`;
}
test(
  "E1161: a call whose callee check reads and whose every returned expression is id-built is no E1161; a call of a global, a parameter, a package that is no library, a computed member, a branch returning a literal or a recursive helper is one E1161, for `Box`, `Host` and `Part`, as JSX or a call",
  () => {
    for (const el of ELS)
      for (const form of FORMS)
        for (const c of CALLS) {
          const d = hitsOf(project([...(c.extra ?? []), lib("src/Badge.tsx", callSrc(el, form, c))]), "E1161");
          expect(d.length, `${el.name} ${form} ${c.what}`).toBe(c.good ? 0 : 1);
          for (const x of d) expect(x.path).toBe("node_modules/@acme/charts/src/Badge.tsx");
        }
  },
  CHECK_CASE_BOUND,
);

// A chain of n helpers, `h<n>` calling `h<n-1>` down to `h1` the identity, is n calls: eight are read, nine are not.
const chain = (n: number): CallCase => ({
  what: `a chain of ${n} calls`,
  head: `const h1 = (k: string): string => k\n${Array.from({ length: n - 1 }, (_, i) => `const h${i + 2} = (k: string): string => h${i + 1}(k)\n`).join("")}`,
  expr: `h${n}(props.id)`,
  good: n <= 8,
});
test(
  "E1161: a chain of eight calls is read and a chain of nine is not (one E1161), for `Box`, `Host` and `Part`, as JSX or a call",
  () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.constantFrom(...ELS),
        fc.constantFrom(...FORMS),
        (n, el, form) => {
          const d = hitsOf(inBadge(callSrc(el, form, chain(n))), "E1161");
          expect(d.length, `${el.name} ${form} ${n}`).toBe(n <= 8 ? 0 : 1);
        },
      ),
      { seed: SEED, numRuns: 36 },
    );
  },
  CHECK_CASE_BOUND,
);

/** Ids drawn from the accepted grammar, as data: leaves and the forms built from them. */
type Leaf = "prop" | "bound" | "destr" | "other" | "otherBound" | "lit" | "litConst" | "concat";
type Ast =
  | { readonly t: Leaf }
  | { readonly t: "tpl" | "constOf" | "call"; readonly a: Ast }
  | { readonly t: "cond"; readonly a: Ast; readonly b: Ast };
const asts = (leaves: readonly Leaf[], calls: boolean): fc.Arbitrary<Ast> =>
  fc.letrec<{ node: Ast }>((tie) => ({
    node: fc.oneof(
      { depthSize: "small", maxDepth: 3 },
      fc.constantFrom(...leaves).map((t): Ast => ({ t })),
      tie("node").map((a): Ast => ({ t: "tpl", a })),
      tie("node").map((a): Ast => ({ t: "constOf", a })),
      fc.tuple(tie("node"), tie("node")).map(([a, b]): Ast => ({ t: "cond", a, b })),
      ...(calls ? [tie("node").map((a): Ast => ({ t: "call", a }))] : []),
    ),
  })).node;
const GOOD_LEAVES: readonly Leaf[] = ["prop", "bound", "destr"];
// The same shapes with the `id` part dropped from every leaf: a different property, a literal, a `const` of either, a concatenation.
const DROPPED_LEAVES: readonly Leaf[] = ["other", "otherBound", "lit", "litConst", "concat"];
function build(ast: Ast, p: string, pre: string[]): string {
  const fresh = (): string => `v${pre.length}`;
  switch (ast.t) {
    case "prop":
      return `${p}.id`;
    case "other":
      return `${p}.name`;
    case "lit":
      return "'box'";
    case "concat":
      return `${p}.id + '.x'`;
    case "bound": {
      const v = fresh();
      pre.push(`const ${v} = ${p}.id`);
      return v;
    }
    case "otherBound": {
      const v = fresh();
      pre.push(`const ${v} = ${p}.name`);
      return v;
    }
    case "litConst": {
      const v = fresh();
      pre.push(`const ${v} = 'box'`);
      return v;
    }
    case "destr":
      if (!pre.includes(`const { id } = ${p}`)) pre.push(`const { id } = ${p}`);
      return "id";
    case "tpl":
      return tpl(build(ast.a, p, pre));
    case "constOf": {
      const e = build(ast.a, p, pre);
      const v = fresh();
      pre.push(`const ${v} = ${e}`);
      return v;
    }
    case "call":
      return `ident(${build(ast.a, p, pre)})`;
    case "cond": {
      const a = build(ast.a, p, pre);
      const b = build(ast.b, p, pre);
      return `${p}.name ? ${a} : ${b}`;
    }
  }
}
const PARAMS = fc.constantFrom("props", "p", "input", "args");

test(
  "E1161: an id drawn from the accepted grammar (`<p>.id`, a `const`, a destructured `id`, templates, conditionals, calls of those) is no E1161, whatever the parameter's name, the element and the form",
  () => {
    fc.assert(
      fc.property(
        asts(GOOD_LEAVES, true),
        PARAMS,
        fc.constantFrom(...ELS),
        fc.constantFrom(...FORMS),
        (ast, p, el, form) => {
          const pre: string[] = [];
          const expr = build(ast, p, pre);
          const src = renderEl(el, form, p, pre, [id(expr)]);
          expect(hitsOf(inBadge(src), "E1161"), src).toEqual([]);
        },
      ),
      { seed: SEED, numRuns: 60 },
    );
  },
  CHECK_CASE_BOUND,
);

test(
  "E1161: the same grammar with the `id` part dropped from every leaf is one E1161, whatever the parameter's name, the element and the form",
  () => {
    fc.assert(
      fc.property(
        asts(DROPPED_LEAVES, true),
        PARAMS,
        fc.constantFrom(...ELS),
        fc.constantFrom(...FORMS),
        (ast, p, el, form) => {
          const pre: string[] = [];
          const expr = build(ast, p, pre);
          const src = renderEl(el, form, p, pre, [id(expr)]);
          expect(hitsOf(inBadge(src), "E1161").length, src).toBe(1);
        },
      ),
      { seed: SEED, numRuns: 60 },
    );
  },
  CHECK_CASE_BOUND,
);

// What keeps a literal id out of the shapes E1161 does not judge: k.library names nothing else. A red case is a hole in the gate (a literal id built into the file's derived id changes with the installer).
test(
  "a literal `id` reaching a base element through a spread of an object literal, or a call argument held in a variable, is reported by some rule at the library's path (HOLE if red: E1161 does not judge it and no rule of the spec does)",
  () => {
    const smuggled = [
      badge("<Box {...{ id: 'box' }} />"),
      `${UI}const args = { id: 'box' }\nexport default function Badge(props: { id: string }) {\n  return Box(args)\n}\n`,
    ];
    for (const src of smuggled) {
      const d = check(inBadge(src), {}).diagnostics.filter((x) => x.path === "node_modules/@acme/charts/src/Badge.tsx");
      expect(
        d.map((x) => x.code),
        src,
      ).not.toEqual([]);
    }
  },
  CHECK_CASE_BOUND,
);

test(
  "E1161: the same elements in an app module's file are not E1161 (the rule reads library files)",
  () => {
    const files = [...project(), { path: "modules/shop/Plain.tsx", source: badge('<Box id="box" p="2" />') }];
    expect(hitsOf(files, "E1161").map((d) => d.path)).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test(
  "In that project, a cast `x as string` in `src/Badge.tsx` is one E1757 at `node_modules/@acme/charts/src/Badge.tsx`",
  () => {
    const src = `${UI}declare const x: unknown\nexport default function Badge(props: { id: string }) {\n  const s = x as string\n  return <Box id={\`\${props.id}.box\`}>{s}</Box>\n}\n`;
    const d = hitsOf(inBadge(src), "E1757", {});
    expect(d.length).toBe(1);
    expect(d[0]?.path).toBe("node_modules/@acme/charts/src/Badge.tsx");
    expect(d[0]?.fix).toBeUndefined();
  },
  CHECK_CASE_BOUND,
);

test(
  "In that project, an import of `@keel/store/internal` in `src/Badge.tsx` is one E1576, at the library's path",
  () => {
    const src = badge(
      "<Box id={`${props.id}.box`} />",
      `${UI}import { serverState } from '@keel/store/internal'\nvoid serverState\n`,
    );
    const d = hitsOf(inBadge(src), "E1576");
    expect(d.length).toBe(1);
    expect(d[0]?.path).toBe("node_modules/@acme/charts/src/Badge.tsx");
  },
  CHECK_CASE_BOUND,
);

test(
  "E1757 in a library file: a cast in `unsafe/` outside an `unsafe()` call is reported at the library's path, one inside the call is not",
  () => {
    const outside = lib("unsafe/u.ts", "declare const c: unknown\nexport const u = (): string => c as string\n");
    const inside = lib("unsafe/u.ts", "declare const c: unknown\nexport const u = unsafe('r', () => c as string)\n");
    const bad = hitsOf(project([outside]), "E1757", {});
    expect(bad.map((d) => d.path)).toEqual(["node_modules/@acme/charts/unsafe/u.ts"]);
    expect(hitsOf(project([inside]), "E1757", {})).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test(
  "E1757: a cast reached only through a chain of re-exports is reported at the file holding it",
  () => {
    const files = project([
      lib("src/index.ts", "export { default as Badge } from './Badge.tsx'\nexport * from './deep/index.ts'\n"),
      lib("src/deep/index.ts", "export * from './inner.ts'\n"),
      lib("src/deep/inner.ts", "declare const v: unknown\nexport const inner = v as string\n"),
    ]);
    const d = hitsOf(files, "E1757", {});
    expect(d.map((x) => x.path)).toEqual(["node_modules/@acme/charts/src/deep/inner.ts"]);
  },
  CHECK_CASE_BOUND,
);

// A library is where a third party's code enters an app: every rule reports in a library file as in an app's own. A by-code fixture of one source file (its `modules/<x>/module.ts`
// manifest aside) is placed at `src/<basename>` in the library and, as the control, at `modules/charts/src/<basename>` in an app holding the same other files.
type Fixture = (typeof CODE_FIXTURES)[string];
const MANIFEST = /^modules\/[^/]+\/module\.ts$/;
/** The one file of a one-file fixture (a lone file, or the one file beside its manifest), else undefined. */
function theFile(fx: Fixture): { path: string; source: string } | undefined {
  if (fx.bad.length === 1) return fx.bad[0];
  const rest = fx.bad.filter((x) => !MANIFEST.test(x.path));
  return rest.length === 1 ? rest[0] : undefined;
}
/** The package folder whose `node_modules/@keel/*` holds the kernel: both twins resolve `@keel/*` from it, as a project with the kernel installed does (a fixture's own root, the router package's, resolves `@keel/router` only through that package's self-reference). */
const KERNEL_ROOT = path.join(repoRoot(import.meta.dirname), "packages", "check", path.sep);
const optsOf = (fx: Fixture): Parameters<typeof check>[1] => ({ ...(fx.badOpts ?? fx.opts ?? {}), root: KERNEL_ROOT });

/** The library project with `source` at `src/<base>`. */
const inLibrary = (base: string, source: string): Files => project([lib(`src/${base}`, source)]);
/** An app with the module `charts`: the library's own files at `modules/charts/<f>` (its package files left out) and `source` at `src/<base>`; the module `shop` lists no dependency. */
function inApp(base: string, source: string): Files {
  const root = `node_modules/${NAME}/`;
  const moved = inLibrary(base, source)
    .filter((x) => x.path.startsWith(root) && !/^(package\.json|index\.js|\.keel\/)/.test(x.path.slice(root.length)))
    .map((x) => ({ path: `modules/charts/${x.path.slice(root.length)}`, source: x.source }));
  return [manifestFile({ id: "shop" }), ...moved];
}
const codesAt = (files: Files, path: string, opts: Parameters<typeof check>[1]) => {
  const d = check(files, opts).diagnostics.filter((x) => x.path === path);
  return { codes: d.map((x) => x.code).sort(), fixes: d.filter((x) => x.fix !== undefined).length };
};

const SMUGGLED: ReadonlyArray<readonly [string, string]> = [
  ["a pii or secret read (reveal outside a server file)", "E1105"],
  ["an ambient capability (crypto.randomUUID)", "E1601"],
  ["an eval call", "E1603"],
  ["an eager element (a conditional child)", "E1403"],
  ["a destructured prop", "E1401"],
  ["a host element (an element outside the base set)", "E1805"],
];
for (const [what, code] of SMUGGLED) {
  test(
    `${what}: the by-code fixture of ${code} placed in a library file is reported ${code} at the library's path, with no fix`,
    () => {
      const fx = CODE_FIXTURES[code];
      expect(fx).toBeDefined();
      const only = fx === undefined ? undefined : theFile(fx);
      expect(only, `${code} is a one-file fixture`).toBeDefined();
      const base = (only?.path ?? "x.ts").split("/").at(-1) ?? "x.ts";
      const d = hitsOf(inLibrary(base, only?.source ?? ""), code, fx === undefined ? {} : optsOf(fx));
      expect(d.length).toBeGreaterThanOrEqual(1);
      for (const x of d) {
        expect(x.path).toBe(`node_modules/@acme/charts/src/${base}`);
        expect(x.fix).toBeUndefined();
      }
    },
    CHECK_CASE_BOUND,
  );
}

/** The by-code fixtures of one source file: no exclusion by code. */
const ONE_FILE = Object.entries(CODE_FIXTURES).flatMap(([code, fx]) => {
  const only = theFile(fx);
  return only === undefined
    ? []
    : [{ code, source: only.source, base: only.path.split("/").at(-1) ?? "x.ts", opts: optsOf(fx) }];
});
/** Rules only a library has (k.library Rules): reported in a library file, never in an app's. */
const LIBRARY_ONLY = new Set(["E1161", "E1162", "E1163", "E1166", "E1811"]);
/** A library file's token name its shipped tokens lack is E1811 "in place of E1801" (k.looks Needs): an app's E1801 is missing from the library's codes when an E1811 stands for it. */
const replacedBy1811 = (code: string, inLib: readonly string[]): boolean => code === "E1801" && inLib.includes("E1811");
/** `keel check` runs every rule but E1106 (k.formats Who declares) over a library's files (k.library In an app): E1106 is left out of the comparison. */
const NOT_OVER_LIBRARY = new Set(["E1106"]);
/** "an E1804 at an element of a library file, or at a library look, is reported in `tokens.ts`" (k.a11y-static Library contrast): not at the library's path, so the library's codes at its own path hold none; the next case asserts where it is. */
const IN_TOKENS_TS = new Set(["E1804"]);

// The space is finite (every one-file fixture of the table), so each is visited once, not sampled.
test(
  "for every one-file by-code fixture but E1106, placed in a library file it reports the codes the same source reports placed in an app module at `modules/<id>/<f>`, at the library's path with no fix",
  () => {
    expect(ONE_FILE.length).toBeGreaterThan(50);
    let reportedInApp = 0;
    const differs: string[] = [];
    for (const { code, source, base, opts } of ONE_FILE) {
      const inLib = codesAt(inLibrary(base, source), `node_modules/${NAME}/src/${base}`, opts);
      const inApplication = codesAt(inApp(base, source), `modules/charts/src/${base}`, opts);
      inLib.codes = inLib.codes.filter((c) => !NOT_OVER_LIBRARY.has(c));
      inApplication.codes = inApplication.codes.filter((c) => !NOT_OVER_LIBRARY.has(c));
      if (inApplication.codes.length > 0) reportedInApp++;
      const extra = inLib.codes.filter((c) => !inApplication.codes.includes(c) && !LIBRARY_ONLY.has(c));
      const missing = inApplication.codes.filter(
        (c) => !inLib.codes.includes(c) && !replacedBy1811(c, inLib.codes) && !IN_TOKENS_TS.has(c),
      );
      if (extra.length > 0 || missing.length > 0 || inLib.fixes > 0)
        differs.push(`${code}: library [${inLib.codes}] app [${inApplication.codes}] fixes ${inLib.fixes}`);
    }
    expect(reportedInApp, "fixtures the app twin reports on").toBeGreaterThan(30);
    expect(differs).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test(
  "an E1804 at an element of a library file, as the by-code fixture of E1804 places one, is reported in `tokens.ts` at the opening quote of the app's key for its `fg`, once, with no E1804 at the library's path",
  () => {
    const fx = CODE_FIXTURES.E1804;
    const only = fx === undefined ? undefined : theFile(fx);
    expect(only, "E1804 is a one-file fixture").toBeDefined();
    const base = (only?.path ?? "x.ts").split("/").at(-1) ?? "x.ts";
    const tokensTs = `export const tokens = {\n  color: { "white": "#ffffff", "mid": "#949494", "ink": "#111111" },\n};\n`;
    const files = [...inLibrary(base, only?.source ?? ""), { path: "tokens.ts", source: tokensTs }];
    const d = hitsOf(files, "E1804", fx === undefined ? {} : optsOf(fx));
    expect(d.length).toBe(1);
    expect(d[0]?.path).toBe("tokens.ts");
    expect(d[0]?.message).toMatch(/^mid on white is [\d.]+:1 in light, needs [\d.]+:1; override in tokens\.ts$/);
    expect(d[0]?.fix).toBeUndefined();
    expect(atText(tokensTs, '"mid"', d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(true);
    expect(d.filter((x) => x.path.startsWith("node_modules/"))).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test(
  "In that project, `import x from '../../outside.ts'` in `src/Badge.tsx` is one E1163 at the specifier",
  () => {
    const src = badge("<Box id={`${props.id}.box`} />", `${UI}import x from '../../outside.ts'\nvoid x\n`);
    const d = hitsOf(inBadge(src), "E1163");
    expect(d.length).toBe(1);
    expect(d[0]?.path).toBe("node_modules/@acme/charts/src/Badge.tsx");
    expect(d[0]?.line).toBe(2);
    expect(d[0]?.fix).toBeUndefined();
    const col = `import x from '../../outside.ts'`.indexOf("'") + 1;
    expect(d[0]?.col).toBeGreaterThanOrEqual(col);
    expect(d[0]?.col).toBeLessThanOrEqual(col + "'../../outside.ts'".length - 1);
  },
  CHECK_CASE_BOUND,
);

/** `n` levels of `../` in a file `depth` folders under `src/`: the target leaves the package folder when `n` is more than `depth + 1`. */
type Form = "import" | "reexport" | "dynamic";
const upFrom = (
  depth: number,
  n: number,
  form: "import" | "reexport" | "dynamic",
): { files: Files; leaves: boolean; spec: string } => {
  const dirs = Array.from({ length: depth }, (_, i) => `d${i}`);
  const spec = `${"../".repeat(n)}target.ts`;
  const body =
    form === "import"
      ? `import { t } from '${spec}'\nexport const f = t\n`
      : form === "reexport"
        ? `export { t as f } from '${spec}'\n`
        : `export const f = () => import('${spec}')\n`;
  const file = lib(`src/${dirs.map((d) => `${d}/`).join("")}f.ts`, body);
  return { files: project([file]), leaves: n > depth + 1, spec };
};

test(
  "E1163: a relative import, re-export or literal `import()` that climbs out of the package folder is one E1163 at its specifier, one that stays inside is none, at any depth",
  () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4 }),
        fc.integer({ min: 1, max: 8 }),
        fc.constantFrom<Form[]>("import", "reexport", "dynamic"),
        (depth, n, form) => {
          const { files, leaves } = upFrom(depth, n, form);
          const d = hitsOf(files, "E1163");
          expect(d.length).toBe(leaves ? 1 : 0);
          for (const x of d) {
            expect(x.path.startsWith("node_modules/@acme/charts/src/")).toBe(true);
            expect(x.fix).toBeUndefined();
          }
        },
      ),
      { seed: SEED, numRuns: 80 },
    );
  },
  CHECK_CASE_BOUND,
);

test(
  "E1163: a library file reaching the app's module by a relative path, or another library's folder by one, is one E1163 (a smuggled import of app code)",
  () => {
    const toApp = "../../../../modules/shop/Page.tsx";
    const toSibling = "../../other/src/index.ts";
    for (const spec of [toApp, toSibling]) {
      const files = project([lib("src/Reach.ts", `import { x } from '${spec}'\nexport const reach = x\n`)]);
      const d = hitsOf(files, "E1163");
      expect(d.length, spec).toBe(1);
      expect(d[0]?.path).toBe("node_modules/@acme/charts/src/Reach.ts");
    }
  },
  CHECK_CASE_BOUND,
);

test(
  "E1163: a library file importing itself, a package of `@keel/*` or another library by its package name is no E1163",
  () => {
    const other = [
      lib(
        "package.json",
        JSON.stringify({
          name: "@acme/other",
          version: "1.0.0",
          type: "module",
          keel: "library",
          exports: { ".": { keel: "./src/index.ts", default: "./index.js" } },
        }),
        "@acme/other",
      ),
      lib("index.js", "export {}\n", "@acme/other"),
      { ...manifestFile({ id: "other", exports: ["O"] }, "node_modules/@acme/other") },
      lib("src/index.ts", "export const O = 1\n", "@acme/other"),
      lib(".keel/ledger.json", LEDGER, "@acme/other"),
    ];
    const files = [
      ...project([
        lib(
          "module.ts",
          `import { module } from '@keel/compiler'\nexport default module({ id: 'charts', deps: ['@acme/other'], capabilities: [], public: { exports: ['Badge'] } })\n`,
        ),
        lib(
          "src/Uses.ts",
          "import { O } from '@acme/other'\nimport { Badge } from './Badge.tsx'\nexport const u = [O, Badge]\n",
        ),
      ]),
      ...other,
    ];
    expect(hitsOf(files, "E1163")).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test(
  "A bare import in a library file is read as in an app file and is no E1163, whatever the package",
  () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{4,10}$/), (pkg) => {
        const files = project([lib("src/Uses.ts", `import { x } from '${pkg}'\nexport const u = x\n`)]);
        expect(hitsOf(files, "E1163")).toEqual([]);
      }),
      { seed: SEED, numRuns: 20 },
    );
  },
  CHECK_CASE_BOUND,
);

test(
  "A bare import there is read as in an app file: a `node:` import an app file is refused for (E1759) is refused in the library file at the library's path, and in the app twin alike",
  () => {
    const source = "import { readFileSync } from 'node:fs'\nexport const r = readFileSync\n";
    const inLib = hitsOf(inLibrary("Read.ts", source), "E1759", {});
    expect(inLib.map((x) => x.path)).toEqual(["node_modules/@acme/charts/src/Read.ts"]);
    expect(inLib[0]?.fix).toBeUndefined();
    expect(hitsOf(inApp("Read.ts", source), "E1759", {}).map((x) => x.path)).toEqual(["modules/charts/src/Read.ts"]);
  },
  CHECK_CASE_BOUND,
);
