import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { FileScope } from "../types/FileScope.ts";
import type { SourceFile } from "../types/SourceFile.ts";

const CLI = "node_modules/@keel/cli";
const AGENT_FILES = ["AGENTS.md", "CLAUDE.md"];

const MAX_BYTES = 1_000_000;

const real = (abs: string): string | undefined => {
  try {
    return realpathSync(abs);
  } catch {
    return undefined;
  }
};
/** Whether `abs`, links resolved, is `base` (a real path) or below it; no `base`: always. */
const within = (abs: string, base: string | undefined): boolean => {
  if (base === undefined) return true;
  const r = real(abs);
  const rel = r === undefined ? ".." : relative(base, r);
  return rel.split(/[\\/]/)[0] !== ".." && !isAbsolute(rel);
};
/**
 * A file's text. With `base` (a package's real folder), a file whose real path leaves it, or over 1,000,000 bytes,
 * is absent: a link in a package never reads outside it.
 */
const read = (abs: string, base?: string): string | undefined => {
  try {
    if (!within(abs, base)) return undefined;
    const s = statSync(abs);
    return s.isFile() && (base === undefined || s.size <= MAX_BYTES) ? readFileSync(abs, "utf8") : undefined;
  } catch {
    return undefined;
  }
};
const list = (abs: string, base?: string): string[] => {
  try {
    return within(abs, base) ? readdirSync(abs).sort() : [];
  } catch {
    return [];
  }
};
const parse = (text: string | undefined): unknown => {
  try {
    return text === undefined ? undefined : JSON.parse(text);
  } catch {
    return undefined;
  }
};
const field = (v: unknown, name: string): unknown =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? Reflect.get(v, name) : undefined;

/** The nearest directory at or above `from` holding `rel`. */
function findUp(from: string, rel: string): string | undefined {
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, rel))) return dir;
    if (dirname(dir) === dir) return undefined;
  }
}

/** The folder of the running `@keel/cli`: the nearest `package.json` above this module named `@keel/cli`. */
function cliDir(): string | undefined {
  for (let dir = dirname(fileURLToPath(import.meta.url)); dirname(dir) !== dir; dir = dirname(dir))
    if (field(parse(read(join(dir, "package.json"))), "name") === "@keel/cli") return dir;
  return undefined;
}

/**
 * `<abs>/skills/<name>/SKILL.md` for each skill folder, presented under `as`. With `pkg`, `abs` is a package: only
 * files whose real path stays in its real folder are read (`read`).
 */
const skills = (abs: string, as: string, pkg = false): SourceFile[] => {
  const base = pkg ? real(abs) : undefined;
  if (pkg && base === undefined) return [];
  return list(join(abs, "skills"), base).flatMap((n) => {
    const source = read(join(abs, "skills", n, "SKILL.md"), base);
    return source === undefined ? [] : [{ path: `${as}/skills/${n}/SKILL.md`, source }];
  });
};

/** A package's `package.json` and the files directly in its `docs/`, presented under `as`, inside its real folder. */
const pkgFiles = (abs: string, as: string): SourceFile[] => {
  const base = real(abs);
  if (base === undefined) return [];
  return ["package.json", ...list(join(abs, "docs"), base).map((f) => `docs/${f}`)].flatMap((rel) => {
    const source = read(join(abs, rel), base);
    return source === undefined ? [] : [{ path: `${as}/${rel}`, source }];
  });
};

/** The agent files of the working directory: `AGENTS.md`, `CLAUDE.md`, `.claude/skills/<name>/SKILL.md`. */
const agentFiles = (cwd: string): SourceFile[] => [
  ...AGENT_FILES.flatMap((p) => {
    const source = read(join(cwd, p));
    return source === undefined ? [] : [{ path: p, source }];
  }),
  ...skills(join(cwd, ".claude"), ".claude"),
];

/** The `@keel/*` names a `package.json` lists in `dependencies` and `devDependencies`. */
const keelDeps = (abs: string): string[] =>
  ["dependencies", "devDependencies"].flatMap((k) => {
    const deps = field(parse(read(join(abs, "package.json"))), k);
    return typeof deps === "object" && deps !== null ? Object.keys(deps).filter((n) => n.startsWith("@keel/")) : [];
  });

/** Node resolution of `name` from `from`: the first `node_modules/<name>` at or above it. */
const resolveFrom = (from: string, name: string): string | undefined => {
  const dir = findUp(from, join("node_modules", name, "package.json"));
  return dir === undefined ? undefined : join(dir, "node_modules", name);
};

/**
 * Binary only: the files `keel docs` reads (k.docs Resolution), as project-relative paths the engine resolves
 * (`readDocs`). In the Keel repo (`spec/00-map.md` at or above `cwd`): `spec/**.md`, `docs/GLOSSARY.md` and
 * `packages/cli/skills/`.
 * Otherwise the project root's `package.json`, the running `@keel/cli` as `node_modules/@keel/cli`, and each `@keel/*`
 * package the root's or the cli's `package.json` names, or the root's `node_modules/@keel/` holds, resolved from the
 * root (`node_modules/@keel/<name>`) or else from the cli (`node_modules/@keel/cli/node_modules/@keel/<name>`).
 * `query` and `tree` get the running cli's skills and, for `query`, the agent files, for W1356 and `scaffold project`.
 * A package's files are read only inside its real folder and up to 1,000,000 bytes each (k.docs Resolution).
 */
export function hostDocs(cwd: string, scope: FileScope): SourceFile[] {
  const cli = cliDir();
  const cliSkills = cli === undefined ? [] : skills(cli, CLI, true);
  if (scope === "tree") return cliSkills;
  if (scope !== "docs") return existsSync(join(cwd, "AGENTS.md")) ? [...agentFiles(cwd), ...cliSkills] : [];
  const repo = findUp(cwd, "spec/00-map.md");
  if (repo !== undefined) {
    const specs = (rel: string): SourceFile[] =>
      list(join(repo, rel)).flatMap((n) => {
        const p = `${rel}/${n}`;
        if (n.endsWith(".md")) {
          const source = read(join(repo, p));
          return source === undefined ? [] : [{ path: p, source }];
        }
        return statSync(join(repo, p)).isDirectory() ? specs(p) : [];
      });
    const glossary = read(join(repo, "docs/GLOSSARY.md"));
    return [
      ...specs("spec"),
      ...(glossary === undefined ? [] : [{ path: "docs/GLOSSARY.md", source: glossary }]),
      ...skills(join(repo, "packages/cli"), "packages/cli", true),
      ...agentFiles(cwd),
    ];
  }
  const root = findUp(cwd, "package.json") ?? cwd;
  const out: SourceFile[] = [...agentFiles(cwd)];
  const rootPkg = read(join(root, "package.json"));
  if (rootPkg !== undefined) out.push({ path: "package.json", source: rootPkg });
  if (cli === undefined) return out;
  out.push(...pkgFiles(cli, CLI), ...cliSkills);
  const present = list(join(root, "node_modules/@keel")).map((n) => `@keel/${n}`);
  const names = new Set([...keelDeps(root), ...keelDeps(cli), ...present]);
  names.delete("@keel/cli");
  for (const name of [...names].sort()) {
    const own = resolveFrom(root, name);
    const nested = own === undefined ? resolveFrom(cli, name) : undefined;
    if (own !== undefined) out.push(...pkgFiles(own, `node_modules/${name}`));
    else if (nested !== undefined) out.push(...pkgFiles(nested, `${CLI}/node_modules/${name}`));
  }
  return out;
}
