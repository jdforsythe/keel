// Spec: k.library, the clauses on the app compiling and checking a library's files, each quoted whole:
// 1. "In a project whose `modules/shop/module.ts` lists `'@acme/charts'` in `deps`, whose `node_modules/@acme/charts/` holds `package.json` `{\"name\":\"@acme/charts\",\"version\":\"1.0.0\",\"type\":\"module\",\"keel\":\"library\",\"exports\":{\".\":{\"keel\":\"./src/index.ts\",\"default\":\"./index.js\"}}}`, `index.js` holding `export {}`, a `module.ts` with `id: 'charts'`, `deps: []`, `capabilities: []` and `public: { exports: ['Badge'] }`, `src/index.ts` holding `export { default as Badge } from './Badge.tsx'`, `src/Badge.tsx` whose `Badge` renders `<Box id={`${props.id}.box`} p=\"2\" />`, and `.keel/ledger.json` as `keel ledger --write .keel/ledger.json` writes it in that folder, and whose `modules/shop/Page.tsx` imports `Badge` from `'@acme/charts'` and renders `<Badge id=\"shop.badge\" />`, `keel check` reports no diagnostic."
// 2. "In that project, with the app's `tokens.ts` and a `static` deployable `site` whose `/` page renders `<Badge id=\"shop.badge\" />`, `keel build`'s `dist/site/index.html` holds an element with id `shop.badge.box`, and a `.css` file under `dist/site/` holds the atomic rule of `p=\"2\"`, which the same build without `p=\"2\"` in the library lacks."
// 4. "In that project, with `node_modules/@acme/charts` a symbolic link to a folder beside the project holding the same files, `<box />` in its `src/Badge.tsx` is one E1805 at `node_modules/@acme/charts/src/Badge.tsx`."
// In an app (compiler): "The compiler resolves imports with the `keel` condition on every surface (dev, build, test) and transforms a library's files as the app's, read at `modules/<id>/<f>`: JSX, element ids, and style props into the app's CSS file against the app's `tokens.ts`; the `.keel/` artifacts derive from a library's files at those paths as from the app's, and E1005 compares them over the same files, so a reader of an artifact (E1702, the inspector) judges a library's element as an app's. A linked library's imports resolve from its real folder, as Node's do, so the kernel packages it imports must resolve there to the app's (one workspace install)."
// In an app (check): "`keel check` reads them and runs every rule over them, its type pass included, against the app's `tokens.ts`, kernel packages and `topology.ts`. Wherever a section reads app code or a file under `modules/<id>/` (k.check App code, k.boundary Reach), it reads a library's file `<f>` as it reads `modules/<id>/<f>`, `<id>` the library's, and its `unsafe/` files with their lifted ranges; a section's exclusion of `node_modules/` does not cover library files. A diagnostic in a library file is the app's: located at `node_modules/<name>/<f>`, whichever `node_modules` holds it, and carrying no `fix`. Nothing in the app turns a rule off for a library file. A bare import there is read as in an app file and resolves from the library's folder, so its package is one of the library's `dependencies`; it is no E1163."
// Real binary over a temporary project (library-support.ts); no std package is imported: the library is written by the test. Seed 1337 (every property).
// Binary runs: 2 builds shared by the build cases (with and without `p="2"` in the library), 1 build of the linked library, 1 check shared by the six smuggled-file cases, 6 other checks (clause 1 and its
// property of 3 runs, the linked library twice, the folder case).
// ASSUMPTIONS (spec silent): "the atomic rule of `p=\"2\"`" is the rule of each class the library's element with id `shop.badge.box` carries in `dist/site/index.html` that the build without `p="2"` does not give it,
// found in the `.css` files under `dist/site/` as `.<class>{...padding...}`; the tokens are `{ color: { fg, bg }, space: { 1, 2, 3 } }`. A folder "beside the project" is `<project>-lib`; it gets a `node_modules/@keel` link so its files
// resolve `@keel/ui` from their real path, as a workspace package does (the spec: "one workspace install").
import { mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, expect, test } from "vitest";
import {
  LIB,
  NAME,
  SEED,
  SLOW,
  siteTree,
  type Rec,
  type Tree,
  cleanup,
  diags,
  filesUnder,
  keel,
  library,
  materialize,
  project,
  write,
} from "./library-support.ts";

const BADGE = `${LIB}/src/Badge.tsx`;
const badge = (body: string): string =>
  `import { Box } from '@keel/ui'\nexport default function Badge(props: { id: string }) {\n  return ${body}\n}\n`;

/** `keel check` over `tree` in a temporary project, removed after. */
function checkOf(tree: Tree): { status: number | null; diags: Rec[] } {
  const dir = materialize(tree);
  try {
    const r = keel(dir, ["check"]);
    return { status: r.status, diags: r.records.filter((x) => x.kind === "diag") };
  } finally {
    cleanup(dir);
  }
}

const withBadge = (src: string, extra: Tree = {}): Tree => ({ ...project(), [BADGE]: src, ...extra });

test(
  "In that project, `keel check` reports no diagnostic",
  () => {
    const r = checkOf(project());
    expect(r.diags).toEqual([]);
    expect(r.status).toBe(0);
  },
  SLOW,
);

test(
  "In that project, `keel check` reports no diagnostic, whatever the page id the app gives the Badge and the ids the library derives from it",
  () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{3,8}$/), fc.stringMatching(/^[a-z]{3,8}$/), (id, part) => {
        const tree = {
          ...project(),
          "modules/shop/Page.tsx": `import { Badge } from '${NAME}'\nexport default function Page() {\n  return <Badge id="shop.${id}" />\n}\n`,
          [BADGE]: badge(`<Box id={\`\${props.id}.${part}\`} p="2" />`),
        };
        expect(checkOf(tree).diags).toEqual([]);
      }),
      { seed: SEED, numRuns: 3 },
    );
  },
  SLOW,
);

/** The `dist/site` page and every `.css` under `dist/site` that `keel build` writes for a static project. */
function builtSite(dir: string): { status: number | null; html: string; css: string } {
  const r = keel(dir, ["build"]);
  const css = filesUnder(join(dir, "dist/site"))
    .filter((p) => p.endsWith(".css"))
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
  return { status: r.status, html: readFileSync(join(dir, "dist/site/index.html"), "utf8"), css };
}

/** The classes of the element with id `id` in `html`. */
function classesOf(html: string, id: string): string[] {
  const tag = [...html.matchAll(/<[a-z][^>]*>/g)].map((m) => m[0]).find((t) => t.includes(`id="${id}"`)) ?? "";
  return (/\bclass="([^"]*)"/.exec(tag)?.[1] ?? "").split(/\s+/).filter((c) => c !== "");
}
const ruleOf = (css: string, cls: string): string | undefined =>
  new RegExp(`\\.${cls.replace(/[^\w-]/g, "\\$&")}\\{[^}]*\\}`).exec(css)?.[0];

let withP: ReturnType<typeof builtSite> | undefined;
let without: ReturnType<typeof builtSite> | undefined;
const dirs: string[] = [];
beforeAll(() => {
  const a = materialize(siteTree());
  const b = materialize(siteTree([library({ files: { "src/Badge.tsx": badge("<Box id={`${props.id}.box`} />") } })]));
  dirs.push(a, b);
  withP = builtSite(a);
  without = builtSite(b);
}, SLOW);
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

test(
  "In that project, with the app's `tokens.ts` and a `static` deployable `site` whose `/` page renders `<Badge id=\"shop.badge\" />`, `keel build`'s `dist/site/index.html` holds an element with id `shop.badge.box`",
  () => {
    expect(withP?.status).toBe(0);
    expect(withP?.html).toContain('id="shop.badge.box"');
    expect(without?.status).toBe(0);
    expect(without?.html).toContain('id="shop.badge.box"');
  },
  SLOW,
);

test(
  'In that project, with the app\'s `tokens.ts`, a `.css` file under `dist/site/` holds the atomic rule of `p="2"`, which the same build without `p="2"` in the library lacks',
  () => {
    const bare = new Set(classesOf(without?.html ?? "", "shop.badge.box"));
    const own = classesOf(withP?.html ?? "", "shop.badge.box").filter((c) => !bare.has(c));
    expect(own.length, 'classes the library\'s `p="2"` gives the element').toBeGreaterThan(0);
    for (const cls of own) {
      expect(ruleOf(withP?.css ?? "", cls), `rule of .${cls} with p`).toMatch(/padding/);
      expect(ruleOf(without?.css ?? "", cls), `rule of .${cls} without p`).toBeUndefined();
    }
  },
  SLOW,
);

/** `tree` with the library moved to a folder beside the project and `node_modules/@acme/charts` a link to it; `run` gets the project's dir. */
function linkedRun<T>(tree: Tree, run: (dir: string) => T): T {
  const prefix = `${LIB}/`;
  const own: Tree = {};
  const rest: Tree = {};
  for (const [p, text] of Object.entries(tree)) {
    if (p.startsWith(prefix)) own[p.slice(prefix.length)] = text;
    else rest[p] = text;
  }
  const dir = materialize(rest);
  const real = `${dir}-lib`;
  try {
    mkdirSync(real, { recursive: true });
    write(real, own);
    mkdirSync(join(real, "node_modules"), { recursive: true });
    symlinkSync(join(dir, "node_modules/@keel"), join(real, "node_modules/@keel"));
    mkdirSync(join(dir, "node_modules/@acme"), { recursive: true });
    symlinkSync(real, join(dir, LIB));
    return run(dir);
  } finally {
    cleanup(dir);
    cleanup(real);
  }
}

test(
  "In that project, with `node_modules/@acme/charts` a symbolic link to a folder beside the project holding the same files, `keel check` reports no diagnostic",
  () => {
    const r = linkedRun(project(), (dir) => keel(dir, ["check"]));
    expect(r.records.filter((x) => x.kind === "diag")).toEqual([]);
  },
  SLOW,
);

test(
  "In that project, with `node_modules/@acme/charts` a symbolic link to a folder beside the project holding the same files, `keel build` writes the page with `shop.badge.box` and the atomic rule of `p=\"2\"`: the library's imports resolve from its real folder to the app's kernel packages",
  () => {
    const out = linkedRun(siteTree(), (dir) => builtSite(dir));
    expect(out.status).toBe(0);
    expect(out.html).toContain('id="shop.badge.box"');
    const bare = new Set(classesOf(without?.html ?? "", "shop.badge.box"));
    const own = classesOf(out.html, "shop.badge.box").filter((c) => !bare.has(c));
    expect(own.length).toBeGreaterThan(0);
    for (const cls of own) expect(ruleOf(out.css, cls)).toMatch(/padding/);
  },
  SLOW,
);

test(
  "In that project, with `node_modules/@acme/charts` a symbolic link to a folder beside the project holding the same files, `<box />` in its `src/Badge.tsx` is one E1805 at `node_modules/@acme/charts/src/Badge.tsx`, with no fix",
  () => {
    const r = linkedRun(withBadge(badge("<box />")), (dir) => keel(dir, ["check"]));
    const hits = diags(r, "E1805");
    expect(hits.length).toBe(1);
    expect(hits[0]?.path).toBe(BADGE);
    expect(hits[0]?.fix).toBeUndefined();
  },
  SLOW,
);

test(
  "In that project, `<box />` in `src/Badge.tsx` is one E1805 at `node_modules/@acme/charts/src/Badge.tsx`, whether the library is a folder or a link",
  () => {
    const dir = materialize(withBadge(badge("<box />")));
    try {
      const hits = diags(keel(dir, ["check"]), "E1805");
      expect(hits.length).toBe(1);
      expect(hits[0]?.path).toBe(BADGE);
      expect(hits[0]?.fix).toBeUndefined();
    } finally {
      cleanup(dir);
    }
  },
  SLOW,
);

// A library is where a third party's code enters an app: each smuggled file below is reported at the library's path, as the app's own file would be. One project holds all of them, one check reads it.
const SMUGGLED: ReadonlyArray<readonly [string, string, string, string]> = [
  ["a cast outside unsafe/", "E1757", "src/cast.ts", "declare const v: unknown\nexport const x = v as string\n"],
  ["a type error the type pass finds", "E1751", "src/type.ts", "export const x: number = 'a'\n"],
  ["an ambient capability", "E1601", "src/id.ts", "export const id = () => crypto.randomUUID()\n"],
  [
    "a read of a secret outside a server file",
    "E1105",
    "src/read.ts",
    "import { reveal } from '@keel/schema'\nexport const x = reveal\n",
  ],
  [
    "an eager element",
    "E1403",
    "src/Eager.tsx",
    "import { Box, Text } from '@keel/ui'\nexport default function Eager(props: { id: string; a: boolean }) { return <Box id={`${props.id}.b`}>{props.a && <Text id={`${props.id}.t`}>x</Text>}</Box> }\n",
  ],
  [
    "an internal entry",
    "E1576",
    "src/internal.ts",
    "import { serverState } from '@keel/store/internal'\nexport const x = serverState\n",
  ],
];
let smuggledRun: Rec[] | undefined;
const smuggled = (): Rec[] => {
  if (smuggledRun !== undefined) return smuggledRun;
  const dir = materialize({
    ...project(),
    ...Object.fromEntries(SMUGGLED.map(([, , file, source]) => [`${LIB}/${file}`, source])),
  });
  try {
    smuggledRun = keel(dir, ["check"]).records.filter((x) => x.kind === "diag");
    return smuggledRun;
  } finally {
    cleanup(dir);
  }
};

for (const [what, code, file] of SMUGGLED) {
  test(
    `In that project, ${what} in a library file is reported ${code} at \`node_modules/@acme/charts/${file}\` from \`keel check\`, with no fix`,
    () => {
      const hits = smuggled().filter((x) => x.code === code && x.path === `${LIB}/${file}`);
      expect(hits.length).toBeGreaterThanOrEqual(1);
      for (const h of hits) expect(h.fix).toBeUndefined();
    },
    SLOW,
  );
}
