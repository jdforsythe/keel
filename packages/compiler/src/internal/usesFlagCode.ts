import fs from "node:fs";
import path from "node:path";
import type { StyleUsage } from "../types/StyleUsage.ts";

/** `@keel/ui`'s build-time flag modules (`src/internal/USES_<NAME>.ts`, or `.js` under `dist/`), and its package root. */
const FLAG = /^(.*?)[\\/](?:dist[\\/])?src[\\/]internal[\\/]USES_(BREAKS|MEDIA|SCHEME)\.[jt]s$/;
const BREAKS: readonly string[] = ["breakBefore", "breakAfter", "breakInside"];

/** True when the package whose root is `dir` is `@keel/ui`. */
const isUi = (dir: string): boolean => {
  try {
    const pkg: unknown = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    return typeof pkg === "object" && pkg !== null && "name" in pkg && pkg.name === "@keel/ui";
  } catch {
    return false;
  }
};

/**
 * The source a build serves for module `id` when it is one of `@keel/ui`'s `USES_*` flags (k.compiler Build): the
 * flag `true` when one of the app's style usages writes what it names (a break prop, `media`, a `Box`'s `scheme`),
 * else `false`, so the bundler drops the run-time code it guards. Null for any other module.
 */
export function usesFlagCode(id: string, usages: readonly StyleUsage[]): string | null {
  const m = FLAG.exec(id.split("?")[0] ?? id);
  const root = m?.[1];
  const name = m?.[2];
  if (root === undefined || name === undefined || !isUi(root)) return null;
  const keys = name === "BREAKS" ? BREAKS : [name.toLowerCase()];
  const used = usages.some((u) => keys.some((k) => Object.hasOwn(u.props, k)));
  return `export const USES_${name} = ${used};\n`;
}
