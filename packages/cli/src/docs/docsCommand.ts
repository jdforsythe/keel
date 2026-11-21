import type { Outcome } from "../internal/Outcome.ts";
import { makeDiag } from "../internal/makeDiag.ts";
import { projectFiles } from "../internal/projectFiles.ts";
import { summary } from "../internal/summary.ts";
import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import type { InstalledDocs } from "./InstalledDocs.ts";
import { agentSync } from "./agentSync.ts";
import { readDocs } from "./readDocs.ts";
import { skillTitle } from "./skillTitle.ts";

const CITE_MAX = 160;
const only = (records: OutRecord[]): Outcome => ({ records, writes: [] });
const fail = (code: string, message: string): Outcome => {
  const d = makeDiag(code, message, { see: "k.docs" });
  return only([d, summary("docs", [d], {})]);
};
const idOf = (path: string): string => (path === "spec/00-map.md" ? "map" : (/([^/]+)\.md$/.exec(path)?.[1] ?? path));
const citesIn = (code: string, id: string, source: string): OutRecord[] =>
  source
    .split("\n")
    .flatMap((l, i) =>
      l.includes(code) ? [{ kind: "docs.cite", code, id, line: i + 1, text: l.trim().slice(0, CITE_MAX) }] : [],
    );

/** Every index row by id, first installed package (by name) wins: the sections the map may lack. */
function indexed(docs: InstalledDocs): Map<string, { name: string; title: string; codes: readonly string[] }> {
  const out = new Map<string, { name: string; title: string; codes: readonly string[] }>();
  for (const [name, p] of docs.installed)
    for (const r of p.index ?? []) if (!out.has(r.id)) out.set(r.id, { name, title: r.title, codes: r.codes });
  return out;
}

/** `keel docs` in the Keel repo: `spec/` and `packages/cli/skills/` (k.docs The Keel repo). */
function repoDocs(input: Input, docs: InstalledDocs): Outcome {
  const specs = [...docs.files.keys()].filter((p) => p.startsWith("spec/") && p.endsWith(".md")).sort();
  const code = input.for;
  if (code !== undefined) {
    const cites = specs.flatMap((p) => citesIn(code, idOf(p), docs.files.get(p) ?? ""));
    return only([...cites, summary(`docs --for ${code}`, [], { lines: cites.length })]);
  }
  const id = input.id ?? "map";
  const skill = docs.skills.find((s) => s.name === id);
  if (skill !== undefined) return only([{ kind: "docs.skill", id, text: skill.text }, summary(`docs ${id}`, [], {})]);
  const path =
    id === "map" ? "spec/00-map.md" : [`spec/kernel/${id}.md`, `spec/std/${id}.md`].find((p) => docs.files.has(p));
  const text = path === undefined ? undefined : docs.files.get(path);
  if (text === undefined) return fail("E1052", `no section or skill ${JSON.stringify(id.slice(0, 24))}; see keel docs`);
  const entries =
    input.id === undefined
      ? docs.skills.map((s) => ({
          kind: "docs.entry",
          id: s.name,
          title: skillTitle(s.description),
          package: "@keel/cli",
          installed: true,
        }))
      : [];
  return only([{ kind: "docs.section", id, text }, ...entries, summary(`docs ${id}`, [], {})]);
}

/**
 * `keel docs` (k.docs): the map and the skills, one section or skill verbatim, `--for <code>` the installed lines
 * citing a code, `--sync` the agent files (k.scaffold). Reads the installed packages (`readDocs`), or the Keel repo.
 * E1065 a section whose package is not installed; E1066 a missing packed file; E1052 an unknown id or two forms.
 */
export function docsCommand(input: Input, io: Io): Outcome {
  const given = [input.id !== undefined, input.for !== undefined, input.sync === true].filter(Boolean).length;
  if (given > 1) return fail("E1052", "give one of <id>, --for <code>, --sync");
  const docs = readDocs(projectFiles(io));
  if (input.sync === true) return agentSync(docs);
  if (docs.repo) return repoDocs(input, docs);
  const index = indexed(docs);
  const cli = `@keel/cli ${docs.cliVersion}`;
  const code = input.for;
  if (code !== undefined) {
    const cites = [...docs.installed.values()].flatMap((p) =>
      (p.index ?? [])
        .filter((r) => r.codes.includes(code))
        .flatMap((r) => citesIn(code, r.id, docs.files.get(`${p.base}/docs/${r.id}.md`) ?? "")),
    );
    return only([...cites, summary(`docs --for ${code}`, [], { lines: cites.length })]);
  }
  const id = input.id;
  if (id === undefined) {
    if (docs.map === undefined) return fail("E1066", `${cli} has no docs/map.json`);
    const listed = new Set(docs.map.map((r) => r.id));
    const entries: OutRecord[] = [
      ...docs.map.map((r) => ({
        kind: "docs.entry",
        id: r.id,
        title: r.title,
        package: r.package,
        installed: docs.installed.has(r.package),
      })),
      ...[...index]
        .filter(([sid]) => !listed.has(sid))
        .map(([sid, r]) => ({ kind: "docs.entry", id: sid, title: r.title, package: r.name, installed: true })),
      ...docs.skills.map((s) => ({
        kind: "docs.entry",
        id: s.name,
        title: skillTitle(s.description),
        package: "@keel/cli",
        installed: true,
      })),
    ];
    return only([
      ...entries,
      summary("docs", [], { sections: entries.length - docs.skills.length, skills: docs.skills.length }),
    ]);
  }
  const skill = docs.skills.find((s) => s.name === id);
  if (skill !== undefined)
    return only([
      { kind: "docs.skill", id, version: docs.cliVersion, text: skill.text },
      summary(`docs ${id}`, [], {}),
    ]);
  const owner = docs.map?.find((r) => r.id === id)?.package ?? index.get(id)?.name;
  if (owner === undefined)
    return docs.map === undefined
      ? fail("E1066", `${cli} has no docs/map.json`)
      : fail("E1052", `no section or skill ${JSON.stringify(id.slice(0, 24))}; see keel docs`);
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
