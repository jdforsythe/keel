import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentSkill } from "@keel/scaffold/create";

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/** A skill's frontmatter `description`, unquoted (as `keel docs` reads it). */
function description(source: string): string {
  const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1] ?? "";
  const line = /^description:[ \t]*(.*)$/m.exec(head)?.[1]?.trim() ?? "";
  const quoted = /^(["'])(.*)\1$/.exec(line);
  return quoted === null ? line : (quoted[2] ?? "");
}

/**
 * The running `@keel/create-app`: its version, from the nearest `package.json` above this module that names it, and
 * the skills it ships in `skills/<name>/SKILL.md` there, in name order (k.create Package).
 */
export function ownPackage(): { readonly version: string; readonly skills: readonly AgentSkill[] } {
  for (let dir = dirname(fileURLToPath(import.meta.url)); dirname(dir) !== dir; dir = dirname(dir)) {
    let pkg: unknown = null;
    try {
      pkg = parse(readFileSync(join(dir, "package.json"), "utf8"));
    } catch {
      continue;
    }
    const name: unknown = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "name") : undefined;
    const version: unknown = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "version") : undefined;
    if (name !== "@keel/create-app" || typeof version !== "string") continue;
    const root = join(dir, "skills");
    let names: string[] = [];
    try {
      names = readdirSync(root).filter((n) => statSync(join(root, n, "SKILL.md"), { throwIfNoEntry: false })?.isFile());
    } catch {
      names = [];
    }
    const skills = names
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map((n) => {
        const text = readFileSync(join(root, n, "SKILL.md"), "utf8");
        return { name: n, description: description(text), text };
      });
    return { version, skills };
  }
  return { version: "0.0.0", skills: [] };
}
