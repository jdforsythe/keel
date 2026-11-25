// k.hosting, Static "**Static.** `keel build` writes `dist/<name>/` per `static` deployable: for each of its routes (one path each, E1553) the document its own `createApp` answers a GET of that path at build (production, a real `ctx` with memory storage, caller `''`; loaders run then), at `index.html` for `/` and `<path>/index.html` otherwise; `404.html`, the not-found document; `assets/` with the resume entry of its islands; `keel-mark.svg`; `csp.txt` (k.security). A route answering other than 200 fails the build (E1588). A static host returns `<path>/index.html` for `<path>` and `404.html` with 404 for a path that is no file, caching as above."
// k.topology, Rules "E1553 a `static` route with params or actions"
// Seed: 1337, fast-check `seed`, `numRuns` 3 (each run is a Vite build).
// Property: for any set of generated static routes (`/` optionally, plus distinct one- and two-segment paths), exactly one document per route is written, at `index.html` for `/`
// and `<path>/index.html` otherwise, holding that route's text and no other route's, and no `.html` other than `404.html` is written elsewhere in `dist/site/`.
// ASSUMPTION: segments are lower-case letters; `assets/` is not a segment generated (the spec names no collision rule for it).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterEach, expect, test } from "vitest";
import { cleanup, keel, materialize } from "./compat-support.ts";
import { SLOW, staticTree } from "./static-support.ts";

const segment = fc.stringMatching(/^[b-z]{1,6}$/);
const pathArb = fc.oneof(
  segment.map((a) => `/${a}`),
  fc.tuple(segment, segment).map(([a, b]) => `/${a}/${b}`),
);
const routesArb = fc
  .tuple(fc.boolean(), fc.uniqueArray(pathArb, { minLength: 1, maxLength: 3 }))
  .map(([root, paths]) => (root ? ["/", ...paths] : paths));

const loaderSrc = (i: number): string =>
  `import { loader } from '@keel/router'\nimport { ok } from '@keel/schema'\nimport { Out } from './Out.schema.ts'\nimport { s } from './s.contract.ts'\n\nexport const r${i} = loader(s, 's.r${i}', { output: Out }, async () => ok({ text: 'TEXT-${i}-1337' }))\n`;

function tree(paths: readonly string[]): Record<string, string> {
  const base = staticTree();
  const {
    ["modules/s/home.server.ts"]: _h,
    ["modules/s/about.server.ts"]: _a,
    ["modules/s/deny.guard.ts"]: _d,
    ...rest
  } = base;
  const files: Record<string, string> = { ...rest };
  const entries = paths.map((p, i) => `'s.r${i}': { path: '${p}' }`).join(", ");
  files["modules/s/s.contract.ts"] =
    `import { contract } from '@keel/router/contract'\nexport const s = contract('s', { ${entries} })\n`;
  const imports = paths.map((_, i) => `import { r${i} } from './r${i}.server.ts'`).join("\n");
  const manifest = paths.map((_, i) => `'s.r${i}': { component: Page, loader: r${i} }`).join(", ");
  files["modules/s/routes.ts"] =
    `import { manifest } from '@keel/router'\nimport Page from './Page.tsx'\n${imports}\nimport { s } from './s.contract.ts'\nexport const routes = manifest(s, { ${manifest} })\n`;
  paths.forEach((_, i) => {
    files[`modules/s/r${i}.server.ts`] = loaderSrc(i);
  });
  return files;
}

const htmlFiles = (root: string, rel = ""): string[] =>
  readdirSync(join(root, rel), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? htmlFiles(root, join(rel, e.name)) : e.name.endsWith(".html") ? [join(rel, e.name)] : [],
  );

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) cleanup(d);
});

test(
  "for any set of generated static routes, exactly one document per route at `index.html` for `/` and `<path>/index.html` otherwise, and no other `.html` but `404.html`",
  () => {
    fc.assert(
      fc.property(routesArb, (paths) => {
        const dir = materialize(tree(paths));
        dirs.push(dir);
        const r = keel(dir, ["build"]);
        expect(r.status).toBe(0);
        const site = join(dir, "dist", "site");
        const where = paths.map((p) => (p === "/" ? "index.html" : `${p.slice(1)}/index.html`));
        expect(htmlFiles(site).sort()).toEqual([...where, "404.html"].sort());
        paths.forEach((_, i) => {
          const html = readFileSync(join(site, where[i] ?? ""), "utf8");
          expect(html).toContain(`TEXT-${i}-1337`);
          paths.forEach((__, j) => {
            if (j !== i) expect(html).not.toContain(`TEXT-${j}-1337`);
          });
        });
        expect(existsSync(join(dir, "dist", "index.html"))).toBe(false);
      }),
      { seed: 1337, numRuns: 3 },
    );
  },
  SLOW * 3,
);
