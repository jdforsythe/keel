import { builtinModules } from "node:module";

const BUILTIN: ReadonlySet<string> = new Set(builtinModules);

/** A Node built-in module specifier: `node:` anything, or a bare name Node lists as built-in (`fs`, `fs/promises`). */
export function isNodeBuiltin(spec: string): boolean {
  return spec.startsWith("node:") || BUILTIN.has(spec);
}
