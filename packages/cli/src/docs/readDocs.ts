import type { AgentSkill } from "@keel/scaffold/agents";
import type { SourceFile } from "../types/SourceFile.ts";
import type { DocsArea } from "./DocsArea.ts";
import type { DocsRow } from "./DocsRow.ts";
import type { DocsTerm } from "./DocsTerm.ts";
import type { InstalledDocs } from "./InstalledDocs.ts";
import { glossaryTerms } from "./glossaryTerms.ts";
import { repoAreas } from "./repoAreas.ts";
import { sectionPath } from "./sectionPath.ts";

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

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((c): c is string => typeof c === "string") : []);

/** The section rows of a packed list (`index.json` sections, a `map.json` area's sections); undefined when not a list. */
function rows(list: unknown): DocsRow[] | undefined {
  if (!Array.isArray(list)) return undefined;
  return list.flatMap((r: unknown) => {
    const id = field(r, "id");
    if (typeof id !== "string") return [];
    const row = { title: text(field(r, "title")), status: "", package: text(field(r, "package")) };
    return [{ id, ...row, holds: text(field(r, "holds")), codes: strings(field(r, "codes")) }];
  });
}

/** The areas of a packed `map.json`, or undefined when the file is absent or not that shape. */
function areas(source: string | undefined): DocsArea[] | undefined {
  const list = field(parse(source), "areas");
  if (!Array.isArray(list)) return undefined;
  return list.flatMap((a: unknown) => {
    const id = field(a, "id");
    return typeof id === "string"
      ? [{ id, title: text(field(a, "title")), sections: rows(field(a, "sections")) ?? [] }]
      : [];
  });
}

/** The terms of a packed `glossary.json`; none when the file is absent or not that shape. */
function terms(source: string | undefined): DocsTerm[] {
  const list = field(parse(source), "terms");
  if (!Array.isArray(list)) return [];
  return list.flatMap((t: unknown) => {
    const term = field(t, "term");
    return typeof term === "string" ? [{ term, text: text(field(t, "text")), ids: strings(field(t, "ids")) }] : [];
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
 * is in the tree, its areas from `spec/areas/` and its terms from `docs/GLOSSARY.md`; otherwise the running `@keel/cli` at `node_modules/@keel/cli`, and each package installed at
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
  const installed = new Map<string, { base: string; version: string; index: DocsRow[] | undefined }>();
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
    const index = rows(field(parse(files.get(`${base}/docs/index.json`)), "sections"));
    installed.set(name, { base, version: versionAt(base), index });
  }
  const known = (id: string): boolean => sectionPath(files, id) !== undefined;
  return {
    repo,
    files,
    cliVersion: versionAt(CLI),
    areas: repo ? repoAreas(files) : areas(files.get(`${CLI}/docs/map.json`)),
    terms: repo ? glossaryTerms(files.get("docs/GLOSSARY.md") ?? "", known) : terms(files.get(`${CLI}/docs/glossary.json`)),
    installed,
    skills,
  };
}
