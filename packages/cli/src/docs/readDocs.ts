import type { AgentSkill } from "@keel/scaffold/agents";
import type { SourceFile } from "../types/SourceFile.ts";
import type { InstalledDocs } from "./InstalledDocs.ts";

const CLI = "node_modules/@keel/cli";

const parse = (text: string | undefined): unknown => {
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};
const field = (v: unknown, name: string): unknown =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? Reflect.get(v, name) : undefined;
const text = (v: unknown): string => (typeof v === "string" ? v : "");

/** The `sections` rows of a packed index or map, or undefined when the file is absent or not that shape. */
function rows(source: string | undefined): InstalledDocs["map"] {
  const list = field(parse(source), "sections");
  if (!Array.isArray(list)) return undefined;
  return list.flatMap((r: unknown) => {
    const id = field(r, "id");
    if (typeof id !== "string") return [];
    const codes = field(r, "codes");
    return [
      {
        id,
        title: text(field(r, "title")),
        package: text(field(r, "package")),
        codes: Array.isArray(codes) ? codes.filter((c): c is string => typeof c === "string") : [],
      },
    ];
  });
}

/** A skill's frontmatter `description`, unquoted. */
function description(source: string): string {
  const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1] ?? "";
  const line = /^description:[ \t]*(.*)$/m.exec(head)?.[1]?.trim() ?? "";
  const quoted = /^(["'])(.*)\1$/.exec(line);
  return quoted === null ? line : (quoted[2] ?? "");
}

/**
 * The docs a project can read (k.docs Resolution), from project-relative files: the Keel repo when `spec/00-map.md`
 * is in the tree; otherwise the running `@keel/cli` at `node_modules/@keel/cli`, and each package installed at
 * `node_modules/@keel/<name>`, else under the cli's own `node_modules`. The host loads the packages the project's
 * and the cli's `package.json` name, so a package is installed when its `package.json` resolves and names it.
 */
export function readDocs(list: readonly SourceFile[]): InstalledDocs {
  const files = new Map(list.map((f) => [f.path, f.source]));
  const repo = files.has("spec/00-map.md");
  const skillDir = (dir: string): AgentSkill[] =>
    [...files.keys()]
      .flatMap((p) => {
        const m = new RegExp(`^${dir}/skills/([^/]+)/SKILL\\.md$`).exec(p);
        const source = files.get(p);
        return m?.[1] === undefined || source === undefined
          ? []
          : [{ name: m[1], description: description(source), text: source }];
      })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const repoSkills = repo ? skillDir("packages/cli") : [];
  const skills = repoSkills.length > 0 ? repoSkills : skillDir(CLI);
  const versionAt = (base: string): string => text(field(parse(files.get(`${base}/package.json`)), "version"));
  const installed = new Map<string, { base: string; version: string; index: InstalledDocs["map"] }>();
  const names = new Set(
    [...files.keys()].flatMap((p) => {
      const m = /^(?:node_modules\/@keel\/cli\/)?node_modules\/(@keel\/[^/]+)\/package\.json$/.exec(p);
      return m?.[1] === undefined ? [] : [m[1]];
    }),
  );
  for (const name of [...names].sort()) {
    const own = `node_modules/${name}`;
    const nested = `${CLI}/node_modules/${name}`;
    const base = files.has(`${own}/package.json`) ? own : files.has(`${nested}/package.json`) ? nested : undefined;
    if (base === undefined || field(parse(files.get(`${base}/package.json`)), "name") !== name) continue;
    installed.set(name, { base, version: versionAt(base), index: rows(files.get(`${base}/docs/index.json`)) });
  }
  return { repo, files, cliVersion: versionAt(CLI), map: rows(files.get(`${CLI}/docs/map.json`)), installed, skills };
}
