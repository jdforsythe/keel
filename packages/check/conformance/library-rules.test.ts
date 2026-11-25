// Spec: k.library, the clauses on `check()` reading a library's files, each quoted whole (the project of the first clause: `modules/shop/module.ts` lists `'@acme/charts'`, `node_modules/@acme/charts/` holds the library, `modules/shop/Page.tsx` renders `<Badge id="shop.badge" />`):
// 3. "In that project, `<box />` in `src/Badge.tsx` is one E1805 in the app's `keel check`, at `node_modules/@acme/charts/src/Badge.tsx`, with no `fix`."
// 5. "In that project, `<Box p=\"2\" />`, `<Box id=\"box\" />`, `<Box id={`box`} />` and `Box({ p: '2' })` in `src/Badge.tsx` are each one E1161; `<Box id={`${props.id}.box`} />` and `<Box id={partId('box')} />`, `partId` a function of that file, are not."
// 6. "In that project, a cast `x as string` in `src/Badge.tsx` is one E1757 at `node_modules/@acme/charts/src/Badge.tsx`, and an import of `@keel/store/internal` there is one E1576."
// 7. "In that project, `import x from '../../outside.ts'` in `src/Badge.tsx` is one E1163 at the specifier."
// Rules: E1161 "an element in a library file whose `id` is missing, a string literal, or a template literal without an expression (fix: none)"
// Rules: E1163 "a library file whose relative import, re-export or literal `import()` resolves outside its package folder, at the specifier" (the manifest half is in library-manifest.test.ts)
// In an app: "`keel check` reads them and runs every rule over them, its type pass included, ... a section's exclusion of `node_modules/` does not cover library files. A diagnostic in a library file is the app's: located at `node_modules/<name>/<f>`, whichever `node_modules` holds it, and carrying no `fix`. Nothing in the app turns a rule off for a library file."
// Seed 1337
// ASSUMPTIONS (spec silent): `check()` is given the library's files at `node_modules/<name>/...` with its `package.json`, `module.ts` and ledger file, as library-manifest.test.ts does; "at the specifier" is the
// specifier's line and a column from its opening quote to its closing one. A library file reads as `modules/charts/<f>`, so a fixture of the by-code table placed at `src/<basename>` reports its code (the table's
// single-file fixtures are used; a fixture reporting E1161 or needing a sibling file is left out). `Part` is not in the public API of any package, so E1161 is asserted for `Box` and `Host`. Of a bare import of a package that
// is no library, k.library says nothing (E1163 reads relative imports, re-exports and literal `import()` only): not asserted.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { CODE_FIXTURES } from "./fixtures-by-code.ts";
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
    { path: `${root}/src/Badge.tsx`, source: badge('<Box id={`${props.id}.box`} p="2" />') },
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

test("In that project, `check()` reports no diagnostic", () => {
  expect(check(project(), NO_TYPES).diagnostics).toEqual([]);
});

test("In that project, `<box />` in `src/Badge.tsx` is one E1805 in the app's `keel check`, at `node_modules/@acme/charts/src/Badge.tsx`, with no `fix`", () => {
  const d = hitsOf(inBadge(badge("<box />")), "E1805");
  expect(d.length).toBe(1);
  expect(d[0]?.path).toBe("node_modules/@acme/charts/src/Badge.tsx");
  expect(d[0]?.fix).toBeUndefined();
});

test("E1805 in a library file is located at `node_modules/<name>/<f>` and carries no fix, whatever the package name and the file", () => {
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
});

test("a library file under `unsafe/` is read with its lifted ranges: E1805 there is reported at the library's path", () => {
  const files = project([lib("unsafe/Raw.tsx", badge("<box />"))]);
  const d = hitsOf(files, "E1805");
  expect(d.map((x) => x.path)).toEqual(["node_modules/@acme/charts/unsafe/Raw.tsx"]);
});

const E1161_BAD: ReadonlyArray<readonly [string, string]> = [
  ['<Box p="2" />', badge('<Box p="2" />')],
  ['<Box id="box" />', badge('<Box id="box" />')],
  ["<Box id={`box`} />", badge("<Box id={`box`} />")],
  ["Box({ p: '2' })", badge("Box({ p: '2' })")],
];
for (const [what, source] of E1161_BAD) {
  test(`In that project, \`${what}\` in \`src/Badge.tsx\` is one E1161, at the library's path, with no fix`, () => {
    const d = hitsOf(inBadge(source), "E1161");
    expect(d.length).toBe(1);
    expect(d[0]?.path).toBe("node_modules/@acme/charts/src/Badge.tsx");
    expect(d[0]?.fix).toBeUndefined();
  });
}

test("In that project, `<Box id={`${props.id}.box`} />` in `src/Badge.tsx` is no E1161", () => {
  expect(hitsOf(inBadge(badge("<Box id={`${props.id}.box`} />")), "E1161")).toEqual([]);
});

test("In that project, `<Box id={partId('box')} />`, `partId` a function of that file, in `src/Badge.tsx` is no E1161", () => {
  const src = `${UI}const partId = (part: string) => part\nexport default function Badge(props: { id: string }) {\n  return <Box id={partId('box')} />\n}\n`;
  expect(hitsOf(inBadge(src), "E1161")).toEqual([]);
});

test("E1161: an element whose `id` is a string literal or a template literal without an expression is one E1161 per element, whatever the text; one built from `props.id` is none", () => {
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
});

test("E1161: a `Host` in a library file with no `id`, or a literal one, is one E1161; one built from `props.id` is none", () => {
  const host = (id: string) =>
    `import { Host } from '@keel/ui'\nimport { s } from '@keel/schema'\nconst In = s.object({ n: s.number() })\nexport default function Badge(props: { id: string }) {\n  return <Host ${id} role="img" label="Chart" input={In} value={{ n: 1 }} code={() => import('./chart.ts').then((m) => m.chart)} />\n}\n`;
  expect(hitsOf(inBadge(host("")), "E1161").length).toBe(1);
  expect(hitsOf(inBadge(host('id="chart"')), "E1161").length).toBe(1);
  expect(hitsOf(inBadge(host("id={`${props.id}.chart`}")), "E1161")).toEqual([]);
});

test("E1161: the same elements in an app module's file are not E1161 (the rule reads library files)", () => {
  const files = [...project(), { path: "modules/shop/Plain.tsx", source: badge('<Box id="box" p="2" />') }];
  expect(hitsOf(files, "E1161").map((d) => d.path)).toEqual([]);
});

test("In that project, a cast `x as string` in `src/Badge.tsx` is one E1757 at `node_modules/@acme/charts/src/Badge.tsx`", () => {
  const src = `${UI}declare const x: unknown\nexport default function Badge(props: { id: string }) {\n  const s = x as string\n  return <Box id={\`\${props.id}.box\`}>{s}</Box>\n}\n`;
  const d = hitsOf(inBadge(src), "E1757", {});
  expect(d.length).toBe(1);
  expect(d[0]?.path).toBe("node_modules/@acme/charts/src/Badge.tsx");
  expect(d[0]?.fix).toBeUndefined();
});

test("In that project, an import of `@keel/store/internal` in `src/Badge.tsx` is one E1576, at the library's path", () => {
  const src = badge(
    "<Box id={`${props.id}.box`} />",
    `${UI}import { serverState } from '@keel/store/internal'\nvoid serverState\n`,
  );
  const d = hitsOf(inBadge(src), "E1576");
  expect(d.length).toBe(1);
  expect(d[0]?.path).toBe("node_modules/@acme/charts/src/Badge.tsx");
});

test("E1757 in a library file: a cast in `unsafe/` outside an `unsafe()` call is reported at the library's path, one inside the call is not", () => {
  const outside = lib("unsafe/u.ts", "declare const c: unknown\nexport const u = (): string => c as string\n");
  const inside = lib("unsafe/u.ts", "declare const c: unknown\nexport const u = unsafe('r', () => c as string)\n");
  const bad = hitsOf(project([outside]), "E1757", {});
  expect(bad.map((d) => d.path)).toEqual(["node_modules/@acme/charts/unsafe/u.ts"]);
  expect(hitsOf(project([inside]), "E1757", {})).toEqual([]);
});

test("E1757: a cast reached only through a chain of re-exports is reported at the file holding it", () => {
  const files = project([
    lib("src/index.ts", "export { default as Badge } from './Badge.tsx'\nexport * from './deep/index.ts'\n"),
    lib("src/deep/index.ts", "export * from './inner.ts'\n"),
    lib("src/deep/inner.ts", "declare const v: unknown\nexport const inner = v as string\n"),
  ]);
  const d = hitsOf(files, "E1757", {});
  expect(d.map((x) => x.path)).toEqual(["node_modules/@acme/charts/src/deep/inner.ts"]);
});

// A library is where a third party's code enters an app: every rule reports in a library file as in an app's own. Each fixture below is the by-code table's single-file
// fixture placed at `src/<basename>` in the library.
const SMUGGLED: ReadonlyArray<readonly [string, string]> = [
  ["a pii or secret read (reveal outside a server file)", "E1105"],
  ["an ambient capability (crypto.randomUUID)", "E1601"],
  ["an eval call", "E1603"],
  ["an eager element (a conditional child)", "E1403"],
  ["a destructured prop", "E1401"],
  ["a host element (an element outside the base set)", "E1805"],
];
for (const [what, code] of SMUGGLED) {
  test(`${what}: the by-code fixture of ${code} placed in a library file is reported ${code} at the library's path, with no fix`, () => {
    const fx = CODE_FIXTURES[code];
    expect(fx).toBeDefined();
    const bad = fx?.bad ?? [];
    expect(bad.length).toBe(1);
    const only = bad[0];
    const base = (only?.path ?? "x.ts").split("/").at(-1) ?? "x.ts";
    const files = project([lib(`src/${base}`, only?.source ?? "")]);
    const d = hitsOf(files, code, fx?.badOpts ?? fx?.opts ?? {});
    expect(d.length).toBeGreaterThanOrEqual(1);
    for (const x of d) {
      expect(x.path).toBe(`node_modules/@acme/charts/src/${base}`);
      expect(x.fix).toBeUndefined();
    }
  });
}

/** The by-code fixtures that are one file placed in a library as `src/<basename>`: no library-only code, no manifest, topology or `.keel/` file, no fixture of a code the library's own files report. */
const SAMPLE = Object.entries(CODE_FIXTURES).flatMap(([code, fx]) => {
  const only = fx.bad[0];
  if (fx.bad.length !== 1 || only === undefined) return [];
  if (["E1161", "E1163", "E1166", "E1752", "E1756", "E1801"].includes(code)) return [];
  if (
    !/\.(ts|tsx)$/.test(only.path) ||
    /(^|\/)(module|topology)\.ts$/.test(only.path) ||
    only.path.startsWith(".keel/")
  )
    return [];
  return [
    { code, source: only.source, base: only.path.split("/").at(-1) ?? "x.ts", opts: fx.badOpts ?? fx.opts ?? {} },
  ];
});

test("for every rule code in the by-code fixtures that are one file, that file placed in a library reports the same code at the library's path", () => {
  expect(SAMPLE.length).toBeGreaterThan(10);
  fc.assert(
    fc.property(fc.constantFrom(...SAMPLE), ({ code, source, base, opts }) => {
      const d = hitsOf(project([lib(`src/${base}`, source)]), code, opts);
      expect(d.length, code).toBeGreaterThanOrEqual(1);
      for (const x of d) {
        expect(x.path, code).toBe(`node_modules/@acme/charts/src/${base}`);
        expect(x.fix, code).toBeUndefined();
      }
    }),
    { seed: SEED, numRuns: Math.max(SAMPLE.length * 2, 30) },
  );
});

test("In that project, `import x from '../../outside.ts'` in `src/Badge.tsx` is one E1163 at the specifier", () => {
  const src = badge("<Box id={`${props.id}.box`} />", `${UI}import x from '../../outside.ts'\nvoid x\n`);
  const d = hitsOf(inBadge(src), "E1163");
  expect(d.length).toBe(1);
  expect(d[0]?.path).toBe("node_modules/@acme/charts/src/Badge.tsx");
  expect(d[0]?.line).toBe(2);
  expect(d[0]?.fix).toBeUndefined();
  const col = `import x from '../../outside.ts'`.indexOf("'") + 1;
  expect(d[0]?.col).toBeGreaterThanOrEqual(col);
  expect(d[0]?.col).toBeLessThanOrEqual(col + "'../../outside.ts'".length - 1);
});

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

test("E1163: a relative import, re-export or literal `import()` that climbs out of the package folder is one E1163 at its specifier, one that stays inside is none, at any depth", () => {
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
});

test("E1163: a library file reaching the app's module by a relative path, or another library's folder by one, is one E1163 (a smuggled import of app code)", () => {
  const toApp = "../../../../modules/shop/Page.tsx";
  const toSibling = "../../other/src/index.ts";
  for (const spec of [toApp, toSibling]) {
    const files = project([lib("src/Reach.ts", `import { x } from '${spec}'\nexport const reach = x\n`)]);
    const d = hitsOf(files, "E1163");
    expect(d.length, spec).toBe(1);
    expect(d[0]?.path).toBe("node_modules/@acme/charts/src/Reach.ts");
  }
});

test("E1163: a library file importing itself, a package of `@keel/*` or another library by its package name is no E1163", () => {
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
});
