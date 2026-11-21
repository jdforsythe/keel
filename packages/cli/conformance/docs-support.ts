// Shared fixtures for the k.docs conformance (not a test file). Seed 1337 where a test generates input.
// Shapes are the ones k.docs "Packed files" states: `node_modules/@keel/<name>/package.json` with a `version`,
// `docs/index.json` `{ sections: [{ id, title, codes }] }`, `docs/<id>.md`; the cli adds `docs/map.json`
// `{ sections: [{ id, title, package }] }` and `skills/<name>/SKILL.md` with `name` and `description` frontmatter.
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

/** The running `@keel/cli`: package.json, map.json (`map` rows: id, title, owner package name) and skills. */
export function cliPkg(
  map: { id: string; title: string; package: string }[],
  skills: Skill[],
  opts: { omitMap?: boolean; own?: Section[] } = {},
): Files {
  const base = "node_modules/@keel/cli";
  const files = pkg("cli", CLI_VERSION, opts.own ?? []);
  if (opts.omitMap !== true) files.push({ path: `${base}/docs/map.json`, source: json({ sections: map }) });
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
        { id: "k.router", title: "Routes", package: "@keel/router" },
        { id: "std.tables", title: "Tables", package: "@keel/std-tables" },
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
