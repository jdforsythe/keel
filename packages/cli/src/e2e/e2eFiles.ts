import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { E2E_FILE } from "./E2E_FILE.ts";

function walk(root: string, rel: string, out: string[]): void {
  const full = join(root, rel);
  if (!existsSync(full)) return;
  for (const n of readdirSync(full).sort()) {
    if (n === "node_modules" || n.startsWith(".")) continue;
    const r = `${rel}/${n}`;
    if (statSync(join(root, r)).isDirectory()) walk(root, r, out);
    else if (E2E_FILE.test(r)) out.push(r);
  }
}

/** The e2e files of the project at `cwd` (k.e2e Files), each path from it, narrowed by `filters` as vitest does (a substring). */
export function e2eFiles(cwd: string, filters: readonly string[]): string[] {
  const out: string[] = [];
  walk(cwd, "test", out);
  const modules = join(cwd, "modules");
  if (existsSync(modules)) for (const m of readdirSync(modules).sort()) walk(cwd, `modules/${m}/test`, out);
  return filters.length === 0 ? out : out.filter((f) => filters.some((p) => f.includes(p.replace(/^\.\//, ""))));
}
