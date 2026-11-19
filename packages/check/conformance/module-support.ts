import { check } from "@keel/check";
// Shared helpers for the k.module conformance files (not a test file). Public API only. Seed 1337.
// Assumed fixture conventions (spec is silent on specifiers): app modules live at modules/<id>/,
// cross-module imports are relative paths naming the exporting file (no barrels),
// stdlib modules are resolved as package specifiers `@keel/std-x/<File>` from node_modules/@keel/std-x/.
import fc from "fast-check";
import type { Files } from "./support.ts";

export { SEED } from "./support.ts";
export type { Files };

export interface Manifest {
  id: string;
  deps?: string[];
  capabilities?: string[];
  exports?: string[];
  routes?: string[];
}

export const lowerId = fc.stringMatching(/^[a-z]{4,9}$/);
export const pascal = fc.stringMatching(/^[A-Z][a-z]{3,8}$/);

const list = (xs: string[] = []): string => `[${xs.map((x) => `'${x}'`).join(", ")}]`;

/** Source of a `module.ts` manifest. */
export function manifestSource(m: Manifest): string {
  return `import { module } from '@keel/compiler'
export default module({
  id: '${m.id}',
  deps: ${list(m.deps)},
  capabilities: ${list(m.capabilities)},
  public: { exports: ${list(m.exports)}, routes: ${list(m.routes)} },
})
`;
}

export const manifestFile = (m: Manifest, root = `modules/${m.id}`) => ({
  path: `${root}/module.ts`,
  source: manifestSource(m),
});

/** A file `<dir>/<name>.ts` with a single export `name`. */
export const exportFile = (dir: string, name: string, body = "1") => ({
  path: `${dir}/${name}.ts`,
  source: `export const ${name} = ${body}\n`,
});

/** A routes.ts declaring the given route ids. */
export function routesFile(id: string, ids: string[]) {
  const entries = ids.map((r) => `  '${r}': { path: '/${r.replace(/\./g, "/")}', component: Page },`).join("\n");
  return {
    path: `modules/${id}/routes.ts`,
    source: `import { manifest } from '@keel/router'\nconst Page = () => null\nexport const routes = manifest({\n${entries}\n})\n`,
  };
}

export const codesOf = (files: Files, code: string) => check(files, {}).diagnostics.filter((d) => d.code === code);
export const has = (files: Files, code: string) => codesOf(files, code).length > 0;

/** Import line of `name` from the sibling module `from`, then an export using it. */
export const importer = (id: string, from: string, name: string, file = "OrderCard") => ({
  path: `modules/${id}/${file}.ts`,
  source: `import { ${name} } from '../${from}/${name}.ts'\nexport const ${file} = ${name}\n`,
});
