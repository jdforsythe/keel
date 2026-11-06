import { joinSpec } from "./joinSpec.ts";

/** Resolve a relative specifier to a file in the tree (exact, `.ts`, `.tsx`, `.js` -> `.ts`/`.tsx`, `index`), or null. */
export function resolveImport(files: ReadonlyMap<string, string>, fromFile: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const t = joinSpec(fromFile, spec);
  const js = /\.[cm]?jsx?$/;
  const cands = [
    t,
    `${t}.ts`,
    `${t}.tsx`,
    t.replace(js, ".ts"),
    t.replace(js, ".tsx"),
    `${t}/index.ts`,
    `${t}/index.tsx`,
  ];
  for (const c of cands) if (files.has(c)) return c;
  return null;
}
