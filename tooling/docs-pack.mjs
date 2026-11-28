// Builds each package's packed docs from spec/ and tooling/docs-owners.json: docs/<id>.md per owned section and
// docs/index.json; @keel/cli also gets docs/map.json (the areas of spec/00-map.md and spec/areas/) and
// docs/glossary.json (docs/GLOSSARY.md). Usage: node tooling/docs-pack.mjs [--all | --check] (no flag packs the
// package of the working directory; this is each package's prepack). D0002 a section no package owns; D0003 a
// section two packages own; D0004 an owner that is not a package; D0005 nothing to pack in the working directory;
// W0013 an owner entry for a section that does not exist; D0019 a section in no area or in two; D0020 an area file no
// map row names, a map row with no area file, or an area row naming no section; D0021 a clipped word, a word mixing
// letters and digits or holding two capitals (tooling/titles.json), or a `holds` over 90 characters, in a title or
// `holds` outside backticks.
import fs from "node:fs";
import path from "node:path";
import { codesIn } from "../packages/cli/src/docs/codesIn.ts";
import { glossaryTerms } from "../packages/cli/src/docs/glossaryTerms.ts";
import { repoAreas } from "../packages/cli/src/docs/repoAreas.ts";
import { sectionHead } from "../packages/cli/src/docs/sectionHead.ts";
import { parseArgs, run } from "./output.ts";

export { codesIn };

const root = path.join(import.meta.dirname, "..");
const OWNERS = "tooling/docs-owners.json";
const MAP_PACKAGE = "@keel/cli";
const TITLES = "tooling/titles.json";
const HOLDS_MAX = 90;

const read = (file) => fs.readFileSync(file, "utf8");
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** The text of a spec section's `# id: Title` line, or the id when the line is missing. */
export function titleOf(text, id) {
  return sectionHead(text, id).title;
}

/** The spec tree's markdown files as `spec/...` paths to text, for the cli's readers. */
function specFiles(specRoot) {
  const files = new Map();
  const add = (dir) => {
    const d = path.join(specRoot, dir);
    if (!fs.existsSync(d)) return;
    for (const f of fs.readdirSync(d).sort(byText))
      if (f.endsWith(".md")) files.set(`spec/${dir}/${f}`, read(path.join(d, f)));
  };
  for (const dir of ["kernel", "std", "areas"]) add(dir);
  const map = path.join(specRoot, "00-map.md");
  if (fs.existsSync(map)) files.set("spec/00-map.md", read(map));
  return files;
}

/** The areas of spec/00-map.md and spec/areas/ (k.docs Areas), each section with its own title and status. */
export function readAreas(specRoot) {
  return repoAreas(specFiles(specRoot));
}

/** Every section of spec/kernel and spec/std in area order, then any section no area lists by id. */
export function readSections(specRoot) {
  const found = new Map();
  for (const dir of ["kernel", "std"]) {
    const d = path.join(specRoot, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).sort(byText)) {
      if (!f.endsWith(".md") || f === "README.md") continue;
      const id = f.slice(0, -3);
      const text = read(path.join(d, f));
      found.set(id, { id, file: `spec/${dir}/${f}`, text, headTitle: titleOf(text, id) });
    }
  }
  const listed = [...new Set(readAreas(specRoot).flatMap((a) => a.sections.map((r) => r.id)))];
  const ordered = listed.filter((id) => found.has(id));
  const rest = [...found.keys()].filter((id) => !listed.includes(id)).sort(byText);
  return [...ordered, ...rest].map((id) => found.get(id));
}

/** The words of a title or `holds` that D0021 refuses, each with the reason. */
export function badWords(text, titles) {
  const out = [];
  const plain = text.replace(/`[^`]*`/g, " ");
  for (const word of plain.split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
    const full = titles.clipped[word.toLowerCase()];
    if (full !== undefined) out.push(`"${word}" is clipped; write "${full}"`);
    else if (/^[EWIRBDT]\d{4}$/.test(word) || /^[EWIR]\d{2,3}x+$/.test(word) || titles.names.includes(word)) continue;
    else if (/\p{L}/u.test(word) && /\p{N}/u.test(word)) out.push(`"${word}" mixes letters and digits`);
    else if ((word.match(/\p{Lu}/gu) ?? []).length > 1) out.push(`"${word}" holds two capitals`);
  }
  return out;
}

/**
 * D0019 to D0021 for a spec tree (k.docs Areas, Titles): `areas` from `readAreas`, the section ids, the area files
 * present (`spec/areas/<id>.md` ids) and `titles` (tooling/titles.json).
 */
export function checkAreas(areas, sections, areaFiles, titles) {
  const diags = [];
  const at = (file, line, code, message) => ({ kind: "diag", code, path: file, line, col: 1, message });
  const ids = new Set(sections.map((s) => s.id));
  const where = new Map();
  for (const a of areas) for (const r of a.sections) where.set(r.id, [...(where.get(r.id) ?? []), a.id]);
  for (const s of sections) {
    const list = where.get(s.id) ?? [];
    if (list.length === 0)
      diags.push(at(s.file, 1, "D0019", `${s.id} is in no area; add a row to spec/areas/<area>.md`));
    else if (list.length > 1)
      diags.push(at(s.file, 1, "D0019", `${s.id} is in ${list.length} areas: ${list.join(", ")}`));
    for (const bad of badWords(s.headTitle, titles)) diags.push(at(s.file, 1, "D0021", `${s.id} title: ${bad}`));
  }
  const named = new Set(areas.map((a) => a.id));
  for (const f of areaFiles)
    if (!named.has(f)) diags.push(at(`spec/areas/${f}.md`, 1, "D0020", `area ${f} has no row in spec/00-map.md`));
  for (const a of areas) {
    const file = `spec/areas/${a.id}.md`;
    if (!areaFiles.includes(a.id)) diags.push(at("spec/00-map.md", 1, "D0020", `area ${a.id} has no file ${file}`));
    for (const bad of badWords(a.title, titles))
      diags.push(at("spec/00-map.md", 1, "D0021", `area ${a.id} title: ${bad}`));
    for (const r of a.sections) {
      if (!ids.has(r.id)) diags.push(at(file, 1, "D0020", `${r.id} in area ${a.id} is not a section`));
      for (const bad of badWords(r.holds, titles)) diags.push(at(file, 1, "D0021", `${r.id} holds: ${bad}`));
      if (r.holds.length > HOLDS_MAX)
        diags.push(at(file, 1, "D0021", `${r.id} holds is ${r.holds.length} characters, over ${HOLDS_MAX}`));
    }
  }
  return diags;
}

/** Diagnostics for an owners table `{ package: [section id] }` against the sections and the package names. */
export function checkOwners(owners, sectionIds, packageNames) {
  const diags = [];
  const at = { kind: "diag", path: OWNERS, line: 1, col: 1 };
  const ownersOf = new Map(sectionIds.map((id) => [id, []]));
  for (const [pkg, ids] of Object.entries(owners)) {
    if (!packageNames.includes(pkg)) diags.push({ ...at, code: "D0004", message: `${pkg} is not a package` });
    for (const id of ids) {
      const list = ownersOf.get(id);
      if (list) list.push(pkg);
      else diags.push({ ...at, code: "W0013", message: `${pkg} lists ${id}, which is not a section` });
    }
  }
  for (const [id, list] of ownersOf) {
    if (list.length === 0) diags.push({ ...at, code: "D0002", message: `${id} has no owner package` });
    else if (new Set(list).size > 1)
      diags.push({ ...at, code: "D0003", message: `${id} has two owners: ${[...new Set(list)].join(", ")}` });
  }
  return diags;
}

/**
 * The files each package's `docs/` holds: package name to `{ "docs/<name>": text }`. `@keel/cli` also gets
 * `docs/map.json` from `areas` (`readAreas`) and `docs/glossary.json` from `glossary` (docs/GLOSSARY.md's text).
 */
export function buildDocs(sections, owners, packageNames, areas = [], glossary = "") {
  const ownerOf = new Map();
  for (const [pkg, ids] of Object.entries(owners)) for (const id of ids) ownerOf.set(id, pkg);
  const out = new Map(packageNames.map((p) => [p, {}]));
  for (const s of sections) {
    const files = out.get(ownerOf.get(s.id) ?? "");
    if (files) files[`docs/${s.id}.md`] = s.text;
  }
  for (const [pkg, files] of out) {
    const own = sections
      .filter((s) => ownerOf.get(s.id) === pkg)
      .map((s) => ({ codes: codesIn(s.text), id: s.id, title: s.headTitle }))
      .sort((a, b) => byText(a.id, b.id));
    files["docs/index.json"] = json({ sections: own });
  }
  const known = new Set(sections.map((s) => s.id));
  const map = areas.map((a) => ({
    id: a.id,
    title: a.title,
    sections: a.sections
      .filter((r) => known.has(r.id))
      .map((r) => ({ id: r.id, title: r.title, package: ownerOf.get(r.id) ?? "", holds: r.holds })),
  }));
  const terms = glossaryTerms(glossary, (id) => known.has(id)).map((t) => ({ term: t.term, text: t.text, ids: t.ids }));
  const cli = out.get(MAP_PACKAGE);
  if (cli) {
    cli["docs/map.json"] = json({ areas: map });
    cli["docs/glossary.json"] = json({ terms });
  }
  return out;
}

/** Package folders under packages/ with their names: `[{ name, dir }]`, by name. */
export function listPackages(repo) {
  const base = path.join(repo, "packages");
  return fs
    .readdirSync(base)
    .filter((d) => fs.existsSync(path.join(base, d, "package.json")))
    .map((d) => ({ name: JSON.parse(read(path.join(base, d, "package.json"))).name, dir: path.join(base, d) }))
    .sort((a, b) => byText(a.name, b.name));
}

/** Replaces each given package's `docs/` folder with its built files. Returns the count of files written. */
export function writeDocs(built, packages) {
  let n = 0;
  for (const { name, dir } of packages) {
    fs.rmSync(path.join(dir, "docs"), { recursive: true, force: true });
    for (const [rel, text] of Object.entries(built.get(name) ?? {})) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), text);
      n++;
    }
  }
  return n;
}

/** Owner and area diagnostics for a repo checkout, with what `buildDocs` needs. */
export function checkRepo(repo) {
  const owners = JSON.parse(read(path.join(repo, OWNERS)));
  const spec = path.join(repo, "spec");
  const sections = readSections(spec);
  const areas = readAreas(spec);
  const packages = listPackages(repo);
  const areaDir = path.join(spec, "areas");
  const areaFiles = fs.existsSync(areaDir)
    ? fs
        .readdirSync(areaDir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => f.slice(0, -3))
        .sort(byText)
    : [];
  const titlesFile = path.join(repo, TITLES);
  const titles = fs.existsSync(titlesFile) ? JSON.parse(read(titlesFile)) : { clipped: {}, names: [] };
  const glossaryFile = path.join(repo, "docs", "GLOSSARY.md");
  const glossary = fs.existsSync(glossaryFile) ? read(glossaryFile) : "";
  return {
    owners,
    sections,
    areas,
    glossary,
    packages,
    diags: [
      ...checkOwners(
        owners,
        sections.map((s) => s.id),
        packages.map((p) => p.name),
      ),
      ...checkAreas(areas, sections, areaFiles, titles),
    ],
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = parseArgs();
  const checkOnly = args.flags.has("check");
  await run("docs-pack", () => {
    const { owners, sections, areas, glossary, packages, diags } = checkRepo(root);
    if (checkOnly || diags.some((d) => !d.code.startsWith("W"))) {
      return { diags, counts: { sections: sections.length, packages: packages.length } };
    }
    const here = path.resolve(process.cwd());
    const chosen = args.flags.has("all") ? packages : packages.filter((p) => p.dir === here);
    if (chosen.length === 0) {
      const message = "no package in the working directory; run in packages/<name> or pass --all";
      return { diags: [{ kind: "diag", code: "D0005", message }], counts: {} };
    }
    const built = buildDocs(
      sections,
      owners,
      packages.map((p) => p.name),
      areas,
      glossary,
    );
    const files = writeDocs(built, chosen);
    return {
      diags,
      counts: { files, packages: chosen.length },
      line: `ok docs-pack ${files} files, ${chosen.length} packages`,
    };
  });
}
