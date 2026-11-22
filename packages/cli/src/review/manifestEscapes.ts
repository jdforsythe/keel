import type { Raw } from "./Raw.ts";

const INSTALL = ["preinstall", "install", "postinstall", "prepare"];
const isBag = (v: unknown): v is { readonly [k: string]: unknown } =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * R1101 and R1102 in one `package.json` (k.escapes): each entry of `overrides`, `resolutions`, `pnpm.overrides`,
 * `pnpm.patchedDependencies`; each install script; each name in `pnpm.onlyBuiltDependencies` or set `true` in
 * `pnpm.allowBuilds`. A finding sits at the first line holding its key after its field's; its text is the entry.
 * A file that is not JSON reads as none: `keel check` and the package manager refuse it.
 */
export function manifestEscapes(source: string): Raw[] {
  let pkg: unknown;
  try {
    pkg = JSON.parse(source);
  } catch {
    return [];
  }
  if (!isBag(pkg)) return [];
  const out: Raw[] = [];
  const lineOf = (key: string, after: string): number => {
    const from = Math.max(0, source.indexOf(JSON.stringify(after)));
    const i = source.indexOf(JSON.stringify(key), from);
    return i < 0 ? 1 : source.slice(0, i).split("\n").length;
  };
  const entry = (code: string, field: string, key: string, value: unknown, message: string): void =>
    void out.push({
      code,
      line: lineOf(key, field),
      col: 1,
      text: `${JSON.stringify(key)}: ${JSON.stringify(value)}`,
      message,
    });
  const pnpm = isBag(pkg.pnpm) ? pkg.pnpm : {};
  for (const [field, bag] of [
    ["overrides", pkg.overrides],
    ["resolutions", pkg.resolutions],
    ["overrides", pnpm.overrides],
    ["patchedDependencies", pnpm.patchedDependencies],
  ] as const)
    if (isBag(bag)) for (const [k, v] of Object.entries(bag)) entry("R1101", field, k, v, `${field} entry ${k}`);
  if (isBag(pkg.scripts))
    for (const name of INSTALL) {
      const v = pkg.scripts[name];
      if (typeof v === "string") entry("R1102", "scripts", name, v, `a ${name} script`);
    }
  if (Array.isArray(pnpm.onlyBuiltDependencies))
    for (const v of pnpm.onlyBuiltDependencies)
      if (typeof v === "string") entry("R1102", "onlyBuiltDependencies", v, true, `${v} allowed to build`);
  if (isBag(pnpm.allowBuilds))
    for (const [k, v] of Object.entries(pnpm.allowBuilds))
      if (v === true) entry("R1102", "allowBuilds", k, v, `${k} allowed to build`);
  return out;
}
