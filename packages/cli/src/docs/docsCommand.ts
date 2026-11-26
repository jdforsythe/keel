import type { Outcome } from "../internal/Outcome.ts";
import { makeDiag } from "../internal/makeDiag.ts";
import { projectFiles } from "../internal/projectFiles.ts";
import { summary } from "../internal/summary.ts";
import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import type { DocsArea } from "./DocsArea.ts";
import type { DocsSource } from "./DocsSource.ts";
import type { InstalledDocs } from "./InstalledDocs.ts";
import { agentSync } from "./agentSync.ts";
import { codesIn } from "./codesIn.ts";
import { forBlock } from "./forBlock.ts";
import { forName } from "./forName.ts";
import { readDocs } from "./readDocs.ts";
import { sectionHead } from "./sectionHead.ts";
import { sectionPath } from "./sectionPath.ts";
import { skillTitle } from "./skillTitle.ts";

const CITE_MAX = 160;
const OTHER = { id: "other", title: "Installed sections the map does not list" };
const only = (records: OutRecord[]): Outcome => ({ records, writes: [] });
const fail = (code: string, message: string): Outcome => {
  const d = makeDiag(code, message, { see: "k.docs" });
  return only([d, summary("docs", [d], {})]);
};
const unknownId = (id: string): Outcome =>
  fail("E1052", `no area, section or skill ${JSON.stringify(id.slice(0, 24))}; see keel docs`);
const idOf = (path: string): string => (path === "spec/00-map.md" ? "map" : (/([^/]+)\.md$/.exec(path)?.[1] ?? path));
const citesIn = (code: string, id: string, source: string): OutRecord[] =>
  source
    .split("\n")
    .flatMap((l, i) =>
      l.includes(code) ? [{ kind: "docs.cite", code, id, line: i + 1, text: l.trim().slice(0, CITE_MAX) }] : [],
    );
const areaRecord = (a: DocsArea): OutRecord => ({
  kind: "docs.area",
  id: a.id,
  title: a.title,
  sections: a.sections.length,
});

/** The three `--for` kinds (k.docs Forms): a code (`E1042`), a code block (`E155x`, `E15xx`), any other key a name. */
const isCode = (key: string): boolean => /^[A-Z]\d{4}$/.test(key);
const isBlock = (key: string): boolean => /^[EWIR](?:\d{3}x|\d{2}xx)$/.test(key);

/** `--for <block>` or `--for <name>` over sections in map order, with the summary. */
function forOther(key: string, sources: readonly DocsSource[], docs: InstalledDocs): Outcome {
  const records = isBlock(key) ? forBlock(key, sources) : forName(key, sources, docs.terms);
  return only([...records, summary(`docs --for ${key}`, [], { records: records.length })]);
}

/** `keel docs` in the Keel repo: `spec/`, `docs/GLOSSARY.md` and `packages/cli/skills/` (k.docs The Keel repo). */
function repoDocs(input: Input, docs: InstalledDocs): Outcome {
  const specs = [...docs.files.keys()].filter((p) => p.startsWith("spec/") && p.endsWith(".md")).sort();
  const areas = docs.areas ?? [];
  const key = input.for;
  if (key !== undefined) {
    if (isCode(key)) {
      const cites = specs.flatMap((p) => citesIn(key, idOf(p), docs.files.get(p) ?? ""));
      return only([...cites, summary(`docs --for ${key}`, [], { lines: cites.length })]);
    }
    const listed = areas.flatMap((a) => a.sections.map((r) => r.id));
    const rest = specs
      .filter((p) => /^spec\/(?:kernel|std)\/[^/]+\.md$/.test(p) && !p.endsWith("/README.md"))
      .map(idOf)
      .filter((id) => !listed.includes(id))
      .sort();
    const sources = [...listed, ...rest].flatMap((id) => {
      const path = sectionPath(docs.files, id);
      const text = path === undefined ? undefined : docs.files.get(path);
      if (text === undefined) return [];
      return [{ row: { id, ...sectionHead(text, id), package: "", holds: "", codes: codesIn(text) }, text }];
    });
    return forOther(key, sources, docs);
  }
  const id = input.id ?? "map";
  const skill = docs.skills.find((s) => s.name === id);
  if (skill !== undefined) return only([{ kind: "docs.skill", id, text: skill.text }, summary(`docs ${id}`, [], {})]);
  const area = areas.find((a) => a.id === id);
  if (area !== undefined) {
    const rows = area.sections.map((r) => `| ${r.id} | ${r.title} | ${r.status} | ${r.holds} |\n`);
    const text = `# ${area.id}: ${area.title}\n| id | title | status | holds |\n|-|-|-|-|\n${rows.join("")}`;
    return only([{ kind: "docs.section", id, text }, summary(`docs ${id}`, [], {})]);
  }
  const path = id === "map" ? "spec/00-map.md" : sectionPath(docs.files, id);
  const text = path === undefined ? undefined : docs.files.get(path);
  if (text === undefined) return unknownId(id);
  return only([{ kind: "docs.section", id, text }, summary(`docs ${id}`, [], {})]);
}

/**
 * `keel docs` (k.docs): the areas and the skills, one area's sections, one section or skill verbatim, `--for` a
 * code's citing lines, a code block's codes, or a name's glossary term and sections, `--sync` the agent files
 * (k.scaffold). Reads the installed packages (`readDocs`), or the Keel repo. E1065 a section whose package is not
 * installed; E1066 a missing packed file; E1052 an unknown id or two forms.
 */
export function docsCommand(input: Input, io: Io): Outcome {
  const given = [input.id !== undefined, input.for !== undefined, input.sync === true].filter(Boolean).length;
  if (given > 1) return fail("E1052", "give one of <id>, --for <key>, --sync");
  const docs = readDocs(projectFiles(io));
  if (input.sync === true) return agentSync(docs);
  if (docs.repo) return repoDocs(input, docs);
  const cli = `@keel/cli ${docs.cliVersion}`;
  const key = input.for;
  if (key !== undefined && isCode(key)) {
    const cites = [...docs.installed.values()].flatMap((p) =>
      (p.index ?? [])
        .filter((r) => r.codes.includes(key))
        .flatMap((r) => citesIn(key, r.id, docs.files.get(`${p.base}/docs/${r.id}.md`) ?? "")),
    );
    return only([...cites, summary(`docs --for ${key}`, [], { lines: cites.length })]);
  }
  const id = input.id;
  const skill = id === undefined ? undefined : docs.skills.find((s) => s.name === id);
  if (skill !== undefined)
    return only([
      { kind: "docs.skill", id: skill.name, version: docs.cliVersion, text: skill.text },
      summary(`docs ${skill.name}`, [], {}),
    ]);
  const noMap = fail("E1066", `${cli} has no docs/map.json`);
  const mapped = new Set((docs.areas ?? []).flatMap((a) => a.sections.map((r) => r.id)));
  const extra = new Map<string, DocsArea["sections"][number]>();
  for (const [name, p] of docs.installed)
    for (const r of p.index ?? [])
      if (!mapped.has(r.id) && !extra.has(r.id)) extra.set(r.id, { ...r, package: name, holds: "" });
  const areas: DocsArea[] = [
    ...(docs.areas ?? []),
    ...(extra.size === 0 ? [] : [{ ...OTHER, sections: [...extra.values()] }]),
  ];
  if (docs.areas === undefined && (key !== undefined || id === undefined || !extra.has(id))) return noMap;
  if (key !== undefined) {
    const sources = areas.flatMap((a) =>
      a.sections.flatMap((r) => {
        const p = docs.installed.get(r.package);
        const row = p?.index?.find((x) => x.id === r.id);
        const text = p === undefined ? undefined : docs.files.get(`${p.base}/docs/${r.id}.md`);
        return text === undefined ? [] : [{ row: { ...r, codes: row?.codes ?? [] }, text }];
      }),
    );
    return forOther(key, sources, docs);
  }
  if (id === undefined) {
    const skills = docs.skills.map((s) => ({
      kind: "docs.entry",
      id: s.name,
      title: skillTitle(s.description),
      package: "@keel/cli",
      installed: true,
      holds: "",
    }));
    return only([
      ...areas.map(areaRecord),
      ...skills,
      summary("docs", [], { areas: areas.length, skills: skills.length }),
    ]);
  }
  const area = areas.find((a) => a.id === id);
  if (area !== undefined) {
    const entries = area.sections.map((r) => ({
      kind: "docs.entry",
      id: r.id,
      title: r.title,
      package: r.package,
      installed: docs.installed.has(r.package),
      holds: r.holds,
    }));
    return only([areaRecord(area), ...entries, summary(`docs ${id}`, [], { sections: entries.length })]);
  }
  const owner = areas.flatMap((a) => a.sections).find((r) => r.id === id)?.package;
  if (owner === undefined) return unknownId(id);
  const p = docs.installed.get(owner);
  if (p === undefined) return fail("E1065", `${id} is in ${owner}, which is not installed; add ${owner}`);
  const at = `${owner} ${p.version}`;
  if (p.index === undefined) return fail("E1066", `${at} has no readable docs/index.json`);
  const text = docs.files.get(`${p.base}/docs/${id}.md`);
  if (text === undefined) return fail("E1066", `${at} has no docs/${id}.md`);
  return only([
    { kind: "docs.section", id, package: owner, version: p.version, text },
    summary(`docs ${id}`, [], { tokens: Math.ceil(text.length / 4) }),
  ]);
}
