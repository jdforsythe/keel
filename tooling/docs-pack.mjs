// Builds each package's packed docs from spec/ and tooling/docs-owners.json: docs/<id>.md per owned section and
// docs/index.json; @keel/cli also gets docs/map.json. Usage: node tooling/docs-pack.mjs [--all | --check] (no flag packs
// the package of the working directory; this is each package's prepack). D0002 a section no package owns; D0003 a
// section two packages own; D0004 an owner that is not a package;
// D0005 nothing to pack in the working directory; W0013 an owner entry for a section that does not exist.
import fs from "node:fs";
import path from "node:path";
import { parseArgs, run } from "./output.ts";

const root = path.join(import.meta.dirname, "..");
const OWNERS = "tooling/docs-owners.json";
const MAP_PACKAGE = "@keel/cli";

const read = (file) => fs.readFileSync(file, "utf8");
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** The text of a spec section's `# id: Title` line, or the id when the line is missing. */
export function titleOf(text, id) {
  const m = new RegExp(`^# ${id.replaceAll(".", "\\.")}: (.+)$`, "m").exec(text);
  return m?.[1].trim() ?? id;
}

/** Every diagnostic code a section cites, sorted. */
export function codesIn(text) {
  return [...new Set(text.match(/\b[EWI]\d{4}\b/g) ?? [])].sort(byText);
}

/** `id` to title for the rows of a spec table whose first cell is a section id. */
export function tableTitles(text) {
  const rows = new Map();
  for (const line of text.split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length > 3 && /^(?:k|std)\.[\w-]+$/.test(cells[1] ?? "")) rows.set(cells[1], cells[2] ?? "");
  }
  return rows;
}

/** Every section of spec/kernel and spec/std in map order (the map's table, then the std README's), then any other by id. */
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
  const mapFile = path.join(specRoot, "00-map.md");
  const readme = path.join(specRoot, "std", "README.md");
  const rows = new Map([
    ...(fs.existsSync(mapFile) ? tableTitles(read(mapFile)) : []),
    ...(fs.existsSync(readme) ? tableTitles(read(readme)) : []),
  ]);
  const ordered = [...rows.keys()].filter((id) => found.has(id));
  const rest = [...found.keys()].filter((id) => !rows.has(id)).sort(byText);
  return [...ordered, ...rest].map((id) => {
    const s = found.get(id);
    return { ...s, mapTitle: rows.get(id) || s.headTitle };
  });
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

/** The files each package's `docs/` holds: package name to `{ "docs/<name>": text }`. */
export function buildDocs(sections, owners, packageNames) {
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
  const map = sections.map((s) => ({ id: s.id, package: ownerOf.get(s.id) ?? "", title: s.mapTitle }));
  const cli = out.get(MAP_PACKAGE);
  if (cli) cli["docs/map.json"] = json({ sections: map });
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

/** Owner diagnostics for a repo checkout. */
export function checkRepo(repo) {
  const owners = JSON.parse(read(path.join(repo, OWNERS)));
  const sections = readSections(path.join(repo, "spec"));
  const packages = listPackages(repo);
  return {
    owners,
    sections,
    packages,
    diags: checkOwners(
      owners,
      sections.map((s) => s.id),
      packages.map((p) => p.name),
    ),
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = parseArgs();
  const checkOnly = args.flags.has("check");
  await run("docs-pack", () => {
    const { owners, sections, packages, diags } = checkRepo(root);
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
    );
    const files = writeDocs(built, chosen);
    return {
      diags,
      counts: { files, packages: chosen.length },
      line: `ok docs-pack ${files} files, ${chosen.length} packages`,
    };
  });
}
