// Shared fixtures for the k.docs conformance (not a test file). Seed 1337 where a test generates input.
// Shapes are the ones k.docs "Packed files" states: `node_modules/@keel/<name>/package.json` with a `version`,
// `docs/index.json` `{ sections: [{ id, title, codes }] }`, `docs/<id>.md`; the cli adds `docs/map.json`
// `{ areas: [{ id, title, sections: [{ id, title, package, holds }] }] }`, `docs/glossary.json` `{ terms: [{ term, text, ids }] }`
// and `skills/<name>/SKILL.md` with `name` and `description` frontmatter.
// ASSUMED: the in-process `run` of fixtures.ts reads `node_modules/` paths from its virtual file list, and the
// running `@keel/cli` is the fixture's `node_modules/@keel/cli`. The spec names no other seam for installed packages.
import { type Files, keel as keelRun, parseJsonLines } from "./fixtures";

export { SEED, lines, parseJsonLines, tokens } from "./fixtures";
export type { Files } from "./fixtures";

export type Section = { id: string; title: string; codes?: string[]; text: string };
export type Skill = { name: string; description: string; body: string };
export type Rec = Record<string, unknown>;

export const CLI_VERSION = "7.1.0";

const json = (v: unknown): string => `${JSON.stringify(v)}\n`;

/** An installed package's files under `base` (default `node_modules/@keel/<short>`). */
export function pkg(
  short: string,
  version: string,
  sections: Section[],
  opts: { base?: string; omitFiles?: string[]; omitIndex?: boolean } = {},
): Files {
  const base = opts.base ?? `node_modules/@keel/${short}`;
  const files: Files = [{ path: `${base}/package.json`, source: json({ name: `@keel/${short}`, version }) }];
  if (opts.omitIndex !== true)
    files.push({
      path: `${base}/docs/index.json`,
      source: json({ sections: sections.map((s) => ({ id: s.id, title: s.title, codes: s.codes ?? [] })) }),
    });
  for (const s of sections)
    if (!(opts.omitFiles ?? []).includes(s.id)) files.push({ path: `${base}/docs/${s.id}.md`, source: s.text });
  return files;
}

export const skillText = (s: Skill): string => `---\nname: ${s.name}\ndescription: ${s.description}\n---\n${s.body}`;

export type MapRow = { id: string; title: string; package: string; holds?: string; area?: string };
export type Term = { term: string; text: string; ids: string[] };

/** Rows grouped into areas in first-seen order; a row with no `area` lands in `all`. Area titles are `Area <id>`. */
export function areasOf(map: MapRow[]): { id: string; title: string; sections: Rec[] }[] {
  const out: { id: string; title: string; sections: Rec[] }[] = [];
  for (const r of map) {
    const id = r.area ?? "all";
    let a = out.find((x) => x.id === id);
    if (a === undefined) {
      a = { id, title: `Area ${id}`, sections: [] };
      out.push(a);
    }
    a.sections.push({ id: r.id, title: r.title, package: r.package, holds: r.holds ?? `holds of ${r.id}` });
  }
  return out;
}

/** The running `@keel/cli`: package.json, map.json (`map` rows: id, title, owner package name, area), glossary and skills. */
export function cliPkg(
  map: MapRow[],
  skills: Skill[],
  opts: { omitMap?: boolean; own?: Section[]; terms?: Term[] } = {},
): Files {
  const base = "node_modules/@keel/cli";
  const files = pkg("cli", CLI_VERSION, opts.own ?? []);
  if (opts.omitMap !== true) files.push({ path: `${base}/docs/map.json`, source: json({ areas: areasOf(map) }) });
  if (opts.terms !== undefined) files.push({ path: `${base}/docs/glossary.json`, source: json({ terms: opts.terms }) });
  for (const s of skills) files.push({ path: `${base}/skills/${s.name}/SKILL.md`, source: skillText(s) });
  return files;
}

/** The project's package.json naming `deps` (short names) in `dependencies`. */
export const project = (deps: string[]): Files => [
  {
    path: "package.json",
    source: json({
      name: "app",
      version: "0.0.0",
      dependencies: Object.fromEntries(deps.map((d) => [`@keel/${d}`, "*"])),
    }),
  },
];

export const ROUTER: Section = {
  id: "k.router",
  title: "Routes",
  codes: ["E1451"],
  text: "# k.router: Routes\nstatus: implemented\n\nA route table.\nE1451 duplicate route id.\n",
};
export const CLIENT_SKILL: Skill = {
  name: "keel-client",
  description: "Build client apps with Keel",
  body: "# keel-client\n\nUse stores.\n",
};

/** A baseline: cli (map: k.router -> @keel/router, std.tables -> @keel/std-tables), router installed, tables not. */
export function baseline(extra: Files = []): Files {
  return [
    ...project(["cli", "router"]),
    ...cliPkg(
      [
        { id: "k.router", title: "Routes", package: "@keel/router", area: "routes" },
        { id: "std.tables", title: "Tables", package: "@keel/std-tables", area: "ui" },
      ],
      [CLIENT_SKILL],
    ),
    ...pkg("router", "2.3.4", [ROUTER]),
    ...extra,
  ];
}

export const jsonRecords = async (
  argv: string[],
  files: Files,
): Promise<{ code: number; recs: Rec[]; out: string }> => {
  const r = await keelRun([...argv, "--format=json"], { files });
  return { code: r.code, recs: parseJsonLines(r.stdout), out: r.stdout + r.stderr };
};
export const run = keelRun;
