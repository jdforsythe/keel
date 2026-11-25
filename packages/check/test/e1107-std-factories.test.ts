import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { check } from "../src/index.ts";

const PACKAGES = realpathSync(join(import.meta.dirname, "..", ".."));
const LINKED = [
  "schema",
  "store",
  "compiler",
  "std-text",
  "std-money",
  "std-temporal",
  "std-geo",
  "std-i18n",
  "std-tokens",
  "std-tables",
];
const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

type Files = { path: string; source: string }[];
const MANIFEST = {
  path: "modules/a/module.ts",
  source:
    "import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: [], capabilities: [], public: { exports: [] } })\n",
};
const TOPOLOGY = {
  path: "topology.ts",
  source:
    "import { topology } from '@keel/server'\nexport default topology({ api: { modules: ['a'], adapter: 'node' } })\n",
};

/** `check` over `files` in a project root whose `node_modules/@keel` links the workspace packages. */
function e1107(files: Files, onDisk: Files = []): string[] {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "keel-e1107-std-"));
  roots.push(root);
  const all = [TOPOLOGY, MANIFEST, ...files];
  for (const f of all) {
    mkdirSync(dirname(join(root, f.path)), { recursive: true });
    writeFileSync(join(root, f.path), f.source);
  }
  for (const f of onDisk) {
    mkdirSync(dirname(join(root, f.path)), { recursive: true });
    writeFileSync(join(root, f.path), f.source);
  }
  writeFileSync(join(root, "package.json"), '{"name":"p","type":"module"}\n');
  mkdirSync(join(root, "node_modules", "@keel"), { recursive: true });
  for (const p of LINKED) symlinkSync(join(PACKAGES, p), join(root, "node_modules", "@keel", p));
  return check(all, { root: join(root, sep), types: false })
    .diagnostics.filter((d) => d.code === "E1107")
    .map((d) => d.message);
}

const page = (head: string, state: string): Files => [
  {
    path: "modules/a/Page.tsx",
    source: `import { s } from '@keel/schema'\nimport { store } from '@keel/store'\n${head}\nexport const st = store(s.object({ v: ${state} }), {})\n`,
  },
];

/** Each stdlib schema an app puts in a store, written as an app writes it. */
const STD: readonly [string, string, string][] = [
  ["line()", "import { line } from '@keel/std-text'", "line({ max: 40 })"],
  ["line().nullable()", "import { line } from '@keel/std-text'", "line({ max: 40 }).nullable()"],
  ["para()", "import { para } from '@keel/std-text'", "para({ min: 2, max: 400 })"],
  ["text.line()", "import * as text from '@keel/std-text'", "text.line({ max: 9 })"],
  ["Email", "import { Email } from '@keel/std-text'", "Email"],
  ["Slug", "import { Slug } from '@keel/std-text'", "Slug"],
  ["Money", "import { Money } from '@keel/std-money'", "Money"],
  ["Currency", "import { Currency } from '@keel/std-money'", "Currency"],
  ["Instant", "import { Instant } from '@keel/std-temporal'", "Instant"],
  ["PlainDate", "import { PlainDate } from '@keel/std-temporal'", "PlainDate"],
  ["Duration", "import { Duration } from '@keel/std-temporal'", "Duration"],
  ["Position", "import { Position } from '@keel/std-geo'", "Position"],
  ["Locale", "import { Locale } from '@keel/std-i18n'", "Locale"],
  ["Digested", "import { Digested } from '@keel/std-tokens'", "Digested"],
  ["tablePage(row)", "import { tablePage } from '@keel/std-tables'", "tablePage(s.object({ n: s.string() }))"],
];

describe("E1107 reads a stdlib schema factory as it reads a local schema (k.leave E1107, k.privacy-reads Factories)", () => {
  for (const [name, head, state] of STD)
    it(`${name} in a client store is clean`, () => {
      expect(e1107(page(head, state))).toEqual([]);
    });

  it("a factory's argument is read at the call: `tablePage(row)` with a `.pii('contact')` row is the class", () => {
    const ds = e1107(
      page("import { tablePage } from '@keel/std-tables'", "tablePage(s.object({ e: s.string().pii('contact') }))"),
    );
    expect(ds).toEqual(["store state reaching #k-state holds .pii('contact'), not in clientPii"]);
  });

  it("a `.pii()` on a stdlib factory's result is read: `line({ max: 40 }).pii('name')`", () => {
    const ds = e1107(page("import { line } from '@keel/std-text'", "line({ max: 40 }).pii('name')"));
    expect(ds).toEqual(["store state reaching #k-state holds .pii('name'), not in clientPii"]);
  });

  it("a local helper function building a marked field is still not readable, and names its call", () => {
    const head = "const mark = () => s.string().pii('contact')\nfunction made() { return s.string().pii('contact') }";
    for (const state of ["mark()", "made()"]) {
      const ds = e1107(page(head, state));
      expect(ds).toHaveLength(1);
      expect(ds[0]).toContain(state.slice(0, -2));
      expect(ds[0]?.endsWith("cannot show its .pii() classes")).toBe(true);
    }
  });

  it("a function-local binding is not followed: a marked schema held in a local is not readable", () => {
    const files: Files = [
      {
        path: "modules/a/Page.tsx",
        source:
          "import { s } from '@keel/schema'\nimport { store } from '@keel/store'\nexport const mk = () => {\n  const e = s.string().pii('contact')\n  return store(s.object({ e }), { e: '' })\n}\n",
      },
    ];
    const ds = e1107(files);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.endsWith("cannot show its .pii() classes")).toBe(true);
  });

  it("a package with no source in the project's read (no `node_modules` link) stays not readable", () => {
    const ds = e1107(page("import { line } from 'not-linked-text'", "line({ max: 40 })"));
    expect(ds).toHaveLength(1);
    expect(ds[0]).toContain("line(");
  });

  const KIT: Files = [
    {
      path: "node_modules/kit/package.json",
      source: '{"name":"kit","type":"module","exports":{".":{"types":"./src/index.ts","default":"./src/index.ts"}}}\n',
    },
    {
      path: "node_modules/kit/src/index.ts",
      source: "export { contact } from './contact.ts'\nexport { opaque } from './opaque.ts'\n",
    },
    {
      path: "node_modules/kit/src/contact.ts",
      source:
        "import { s } from '@keel/schema'\nconst mark = (o: { max: number }) => s.string({ max: o.max }).pii('contact')\nexport function contact(o: { max: number }) {\n  const field = mark(o)\n  return field\n}\n",
    },
    {
      path: "node_modules/kit/src/opaque.ts",
      source: "import { s } from '@keel/schema'\nexport function opaque(n: number) {\n  return [s.string()][n]\n}\n",
    },
  ];

  it("a package factory that marks its result inside the package is read: the class reaches E1107", () => {
    expect(e1107(page("import { contact } from 'kit'", "contact({ max: 9 })"), KIT)).toEqual([
      "store state reaching #k-state holds .pii('contact'), not in clientPii",
    ]);
  });

  it("a package factory whose return the reader cannot read stays E1107, naming the call", () => {
    expect(e1107(page("import { opaque } from 'kit'", "opaque(0)"), KIT)).toEqual([
      "store state not readable at opaque(); cannot show its .pii() classes",
    ]);
  });
});
