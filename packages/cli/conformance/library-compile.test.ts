// Spec: k.library, the clauses on the app compiling and checking a library's files, each quoted whole:
// 1. "In a project whose `modules/shop/module.ts` lists `'@acme/charts'` in `deps`, whose `node_modules/@acme/charts/` holds `package.json` `{\"name\":\"@acme/charts\",\"version\":\"1.0.0\",\"type\":\"module\",\"keel\":\"library\",\"exports\":{\".\":{\"keel\":\"./src/index.ts\",\"default\":\"./index.js\"}}}`, `index.js` holding `export {}`, a `module.ts` with `id: 'charts'`, `deps: []`, `capabilities: []` and `public: { exports: ['Badge'] }`, `src/index.ts` holding `export { default as Badge } from './Badge.tsx'`, `src/Badge.tsx` whose `Badge` renders `<Box id={`${props.id}.box`} p=\"2\" />`, and `.keel/ledger.json` as `keel ledger --write .keel/ledger.json` writes it in that folder, and whose `modules/shop/Page.tsx` imports `Badge` from `'@acme/charts'` and renders `<Badge id=\"shop.badge\" />`, `keel check` reports no diagnostic."
// 2. "In that project, the page `keel build` renders holds an element with id `shop.badge.box`, and the app's CSS file holds its padding rule."
// 4. "In that project, with `node_modules/@acme/charts` a symbolic link to a folder beside the project holding the same files, `<box />` in its `src/Badge.tsx` is one E1805 at `node_modules/@acme/charts/src/Badge.tsx`."
// Spec: k.library In an app (the prose the clauses rest on), "A diagnostic in a library file is the app's: located at `node_modules/<name>/<f>`, whichever `node_modules` holds it, and carrying no `fix`." and "`keel check` reads them and runs every rule over them, its type pass included".
// Real binary over a temporary project (library-support.ts); no std package is imported: the library is written by the test. Seed 1337.
// ASSUMPTIONS (spec silent): "the page `keel build` renders" is `dist/site/index.html` of a `static` deployable `site` whose `/` page (`modules/shop/Home.tsx`) renders the Badge;
// "the app's CSS file" is the `.css` files under `dist/`; "its padding rule" is a `padding` declaration there, which the same build without `p="2"` in the library does not write (the fixture app uses none).
// A folder "beside the project" is `<project>-lib`; it gets a `node_modules/@keel` link so its files resolve `@keel/ui` from their real path, as a workspace package does.
// Untested here (no Conformance sentence): the `keel` condition on dev and `keel test`; the build and check cases cover the condition and the type pass.
import { mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { expect, test } from "vitest";
import {
  LIB,
  NAME,
  SEED,
  SLOW,
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

/** The `dist/site` page and every `.css` under `dist/` that `keel build` writes for a static project. */
function builtSite(tree: Tree): { html: string; css: string } {
  const dir = materialize(tree);
  try {
    const r = keel(dir, ["build"]);
    expect(r.status).toBe(0);
    const css = filesUnder(join(dir, "dist"))
      .filter((p) => p.endsWith(".css"))
      .map((p) => readFileSync(p, "utf8"))
      .join("\n");
    return { html: readFileSync(join(dir, "dist/site/index.html"), "utf8"), css };
  } finally {
    cleanup(dir);
  }
}

const SITE = { adapter: "static", home: true } as const;

test(
  "In that project, the page `keel build` renders holds an element with id `shop.badge.box`",
  () => {
    const { html } = builtSite(project(SITE));
    expect(html).toContain('id="shop.badge.box"');
  },
  SLOW,
);

test(
  "In that project, the app's CSS file holds the padding rule of the library's `p=\"2\"`, and holds none when the library's element has no `p`",
  () => {
    const withP = builtSite(project(SITE));
    expect(withP.css).toMatch(/padding/);
    const without = builtSite(
      project({
        ...SITE,
        libraries: [library({ files: { "src/Badge.tsx": badge("<Box id={`${props.id}.box`} />") } })],
      }),
    );
    expect(without.css).not.toMatch(/padding/);
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

// A library is where a third party's code enters an app: each smuggled file below is reported at the library's path, as the app's own file would be.
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

for (const [what, code, file, source] of SMUGGLED) {
  test(
    `In that project, ${what} in a library file is one ${code} at \`node_modules/@acme/charts/${file}\` from \`keel check\`, with no fix`,
    () => {
      const hits = (() => {
        const dir = materialize({ ...project(), [`${LIB}/${file}`]: source });
        try {
          return diags(keel(dir, ["check"]), code);
        } finally {
          cleanup(dir);
        }
      })();
      expect(hits.length).toBeGreaterThanOrEqual(1);
      for (const h of hits) {
        expect(h.path).toBe(`${LIB}/${file}`);
        expect(h.fix).toBeUndefined();
      }
    },
    SLOW,
  );
}
