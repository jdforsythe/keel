// Keeps the seven published skills (packages/cli/skills/<name>/SKILL.md) true. Usage: node tooling/docs-check.mjs
// [--write]; `--write` replaces .claude/skills/<name>/ with a copy of each published skill and checks nothing.
//
// D0006 a fenced ts or tsx block does not type-check; D0007 more than two `ts fragment` blocks in a skill; D0008 an
// `import { ... } from '@keel/...'` (fence or code span) names a package or export that does not exist; D0009 a
// diagnostic code is in neither the explain catalog nor a spec section, or a range (`E19xx`, `E165x`) holds no code;
// D0010 a cited section id has no spec file; D0011 a repo-only path or command; D0012 size over the target, or `name`
// or `description` frontmatter missing; D0013 .claude/skills/<name>/ differs from the published skill; D0014 a block
// imports a relative path no other block of the skill provides.
//
// The scaffold templates (`AGENTS.md` and `CLAUDE.md` as `keel scaffold project` and `keel docs --sync` write them,
// rendered from @keel/scaffold/agents with the published skills): D0015 a cited diagnostic code in neither the explain
// catalog nor a spec section, or a range holding none; D0016 a cited section id with no spec file; D0017 a repo-only
// path or command; D0018 the Keel block of `AGENTS.md` over the `docs.agents` budget of tooling/budgets.json. The
// voice lint (V0003) covers the rendered template text. A diagnostic sits at the template's source file, at the line
// holding the rendered line's text.
//
// Type-checking. All blocks of all skills go through one TypeScript program under the strict profile
// (packages/compiler/tsconfig.strict.json) in a temporary folder outside the repo whose node_modules links every
// workspace package, and is removed afterwards. Each ts or tsx fence becomes a module (`export {}` is appended, so
// line numbers hold). A fence tagged `ts fragment` is not compiled. Blocks of one skill see each other by one rule: a
// relative import (`./todos.ts`) in a compiled block resolves to the first other compiled block of the same skill that
// exports every imported name (a default import needs `export default`); the specifier's text is otherwise ignored.
//
// Repo-only names (D0011), matched in the whole file: `pnpm spec`; `--workspace`; and the path prefixes `spec/`, `docs/`,
// `apps/`, `packages/`, `.claude/` when the character before is not a word character, `@`, `.`, `/` or `-`. So
// `keel docs k.router`, `node_modules/@keel/x/docs/y` and a URL path are not hits. In the templates (D0017) the same
// names are hits but `.claude/skills/`: the Keel block names each skill's copy at `.claude/skills/<name>/SKILL.md` by
// design, so that one path is allowed in the templates and only there.
//
// Section ids (D0010) are the tokens `k.<name>` and `std.<name>` outside a longer dotted name. Codes (D0009) are
// `E`, `W` or `I` plus four digits, and ranges of that shape ending in one or two `x`.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { agentFiles } from "../packages/scaffold/src/agents/index.ts";
import { codesIn, listPackages } from "./docs-pack.mjs";
import { parseArgs, run } from "./output.ts";

const root = path.join(import.meta.dirname, "..");
const SKILLS_DIR = "packages/cli/skills";
const COPY_DIR = ".claude/skills";

/** The published skills and the size target of each, in tokens (chars / 4). */
export const TARGETS = {
  keel: 900,
  "keel-client": 2000,
  "keel-server": 2000,
  "keel-data": 2000,
  "keel-testing": 2000,
  "keel-deploy": 1500,
  "keel-compliance": 1500,
};
export const MAX_FRAGMENTS = 2;

const read = (file) => fs.readFileSync(file, "utf8");
const diag = (code, file, line, message) => ({ kind: "diag", code, path: file, line, col: 1, message });
const lineOf = (text, index) => text.slice(0, index).split("\n").length;
const skillFile = (name) => `${SKILLS_DIR}/${name}/SKILL.md`;

/** Fenced blocks of a markdown text: `{ info, lang, fragment, line, code }`, `line` being the first code line. */
export function fences(text) {
  const out = [];
  let open;
  text.split("\n").forEach((raw, i) => {
    const m = /^\s*(`{3,})(.*)$/.exec(raw);
    if (!open) {
      if (m) open = { mark: m[1], info: (m[2] ?? "").trim(), line: i + 2, lines: [] };
    } else if (m && m[1].length >= open.mark.length && !(m[2] ?? "").trim()) {
      const [lang = "", ...tags] = open.info.split(/\s+/);
      out.push({
        info: open.info,
        lang,
        fragment: tags.includes("fragment"),
        line: open.line,
        code: open.lines.join("\n"),
      });
      open = undefined;
    } else open.lines.push(raw);
  });
  return out;
}

/** `name` and `description` of the frontmatter, or undefined for a missing key. */
export function frontmatter(text) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
  const get = (k) => new RegExp(`^${k}:[ \\t]*(\\S.*)$`, "m").exec(fm)?.[1];
  return { name: get("name"), description: get("description") };
}

/** D0012: frontmatter and size. */
export function checkShape(name, text, target = TARGETS[name]) {
  const file = skillFile(name);
  const diags = [];
  const fm = frontmatter(text);
  if (fm.name === undefined || fm.name.replace(/^["']|["']$/g, "") !== name)
    diags.push(diag("D0012", file, 1, `frontmatter name must be ${name}`));
  if (fm.description === undefined) diags.push(diag("D0012", file, 1, "frontmatter description is missing"));
  const tokens = Math.ceil(text.length / 4);
  if (target !== undefined && tokens > target)
    diags.push(diag("D0012", file, 1, `${tokens} tokens exceed the target ${target}`));
  return diags;
}

/** D0007: more fragments than allowed. */
export function checkFragments(name, text) {
  const frags = fences(text).filter((f) => f.fragment);
  if (frags.length <= MAX_FRAGMENTS) return [];
  return [
    diag(
      "D0007",
      skillFile(name),
      frags[MAX_FRAGMENTS].line - 1,
      `${frags.length} fragments, at most ${MAX_FRAGMENTS}`,
    ),
  ];
}

/** D0011: repo-only paths and commands. */
export const REPO_ONLY = [/\bpnpm spec\b/g, /--workspace\b/g, /(?<![\w@./-])(?:spec|docs|apps|packages|\.claude)\//g];
export function checkRepoOnly(name, text) {
  const diags = [];
  for (const re of REPO_ONLY)
    for (const m of text.matchAll(re))
      diags.push(
        diag("D0011", skillFile(name), lineOf(text, m.index ?? 0), `repo-only name "${m[0]}" in a published skill`),
      );
  return diags;
}

/** D0009: cited codes against the known set. A range needs one known code with its prefix. */
export function checkCodes(name, text, known) {
  const diags = [];
  const file = skillFile(name);
  for (const m of text.matchAll(/(?<![\w])[EWI]\d{4}(?![\w])/g))
    if (!known.has(m[0]))
      diags.push(diag("D0009", file, lineOf(text, m.index ?? 0), `${m[0]} is in no catalog or spec section`));
  for (const m of text.matchAll(/(?<![\w])([EWI]\d{2,3})(x{1,2})(?![\w])/g)) {
    const prefix = m[1];
    if (prefix.length + m[2].length !== 5) continue;
    if (![...known].some((c) => c.startsWith(prefix)))
      diags.push(diag("D0009", file, lineOf(text, m.index ?? 0), `range ${m[0]} holds no known code`));
  }
  return diags;
}

/** D0010: section ids that have no spec file. */
export function checkSections(name, text, ids) {
  const diags = [];
  for (const m of text.matchAll(/(?<![\w./@-])((?:k|std)\.[a-z][\w-]*)(?![\w])(?!\.[a-z])/g))
    if (!ids.has(m[1]))
      diags.push(diag("D0010", skillFile(name), lineOf(text, m.index ?? 0), `${m[1]} is not a spec section`));
  return diags;
}

/** Section ids (file names) of spec/kernel and spec/std. */
export function sectionIds(repo) {
  const ids = new Set();
  for (const dir of ["kernel", "std"]) {
    const d = path.join(repo, "spec", dir);
    if (fs.existsSync(d))
      for (const f of fs.readdirSync(d)) if (f.endsWith(".md") && f !== "README.md") ids.add(f.slice(0, -3));
  }
  return ids;
}

/** Every code the catalog or a spec section holds. */
export function knownCodes(repo) {
  const known = new Set(codesIn(read(path.join(repo, "packages/check/src/internal/EXPLANATIONS.ts"))));
  for (const dir of ["kernel", "std"]) {
    const d = path.join(repo, "spec", dir);
    if (fs.existsSync(d))
      for (const f of fs.readdirSync(d))
        if (f.endsWith(".md")) for (const c of codesIn(read(path.join(d, f)))) known.add(c);
  }
  return known;
}

/** Files under a folder as `relative path` to bytes, sorted. */
function tree(dir) {
  const out = new Map();
  const walk = (d, rel) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.isDirectory()) walk(path.join(d, e.name), `${rel}${e.name}/`);
      else out.set(`${rel}${e.name}`, fs.readFileSync(path.join(d, e.name)));
    }
  };
  walk(dir, "");
  return out;
}

/** D0013: .claude/skills/<name>/ against the published folder. */
export function checkCopy(repo, name) {
  const want = tree(path.join(repo, SKILLS_DIR, name));
  const have = tree(path.join(repo, COPY_DIR, name));
  const file = `${COPY_DIR}/${name}`;
  const diags = [];
  for (const [rel, bytes] of want) {
    const got = have.get(rel);
    if (!got) diags.push(diag("D0013", file, 1, `${rel} is missing; run node tooling/docs-check.mjs --write`));
    else if (!got.equals(bytes))
      diags.push(
        diag("D0013", file, 1, `${rel} differs from ${SKILLS_DIR}/${name}; run node tooling/docs-check.mjs --write`),
      );
  }
  for (const rel of have.keys())
    if (!want.has(rel)) diags.push(diag("D0013", file, 1, `${rel} is not in ${SKILLS_DIR}/${name}`));
  return diags;
}

/** Replaces .claude/skills/<name>/ with the published folder for each name. */
export function writeCopies(repo, names) {
  for (const name of names) {
    const dest = path.join(repo, COPY_DIR, name);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(path.join(repo, SKILLS_DIR, name), dest, { recursive: true });
  }
}

const IMPORT_RE = /import\s+(?:type\s+)?(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*(['"])([^'"]+)\3/g;
const names = (list) =>
  (list ?? "")
    .split(",")
    .map((n) => n.trim().replace(/^type\s+/, ""))
    .filter(Boolean);

/** Names a block exports: `{ named: Set, hasDefault }`. */
export function exportsOf(code) {
  const named = new Set();
  for (const m of code.matchAll(
    /export\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|type|interface|enum)\s+(\w+)/g,
  ))
    named.add(m[1]);
  for (const m of code.matchAll(/export\s*(?:type\s*)?\{([^}]*)\}/g))
    for (const n of names(m[1])) named.add(n.split(/\s+as\s+/).pop() ?? n);
  return { named, hasDefault: /export\s+default\b/.test(code) };
}

/** The type-check inputs of one skill: modules `{ file, text, line }` and the diagnostics of unresolved imports. */
export function blocksOf(name, text) {
  const blocks = fences(text)
    .filter((f) => (f.lang === "ts" || f.lang === "tsx") && !f.fragment)
    .map((f, i) => ({ ...f, file: `${name}/b${i}.${f.lang}`, exports: exportsOf(f.code) }));
  const diags = [];
  for (const b of blocks) {
    b.text = b.code.replace(IMPORT_RE, (whole, def, list, q, spec) => {
      if (!spec.startsWith(".")) return whole;
      const wanted = names(list).map((n) => n.split(/\s+as\s+/)[0] ?? n);
      const from = blocks.find(
        (o) => o !== b && wanted.every((n) => o.exports.named.has(n)) && (!def || o.exports.hasDefault),
      );
      if (!from) {
        diags.push(
          diag(
            "D0014",
            skillFile(name),
            b.line,
            `no other block of ${name} exports ${[def, ...wanted].filter(Boolean).join(", ")} for ${spec}`,
          ),
        );
        return whole;
      }
      return whole.replace(`${q}${spec}${q}`, `${q}./${path.basename(from.file)}${q}`);
    });
    b.text += "\nexport {}\n";
  }
  return { blocks, diags };
}

/** `@keel/...` imports of a text as synthetic type-only imports, one per line, with each origin line. */
export function keelImports(text) {
  const lines = [];
  const origin = [];
  for (const m of text.matchAll(IMPORT_RE)) {
    if (!m[4].startsWith("@keel/")) continue;
    const i = lines.length;
    const list = names(m[2]).map((n, k) => `${n.split(/\s+as\s+/)[0]} as _${i}_${k}`);
    const parts = [m[1] ? `_${i}_d` : undefined, list.length ? `{ ${list.join(", ")} }` : undefined].filter(Boolean);
    if (parts.length === 0) continue;
    lines.push(`import type ${parts.join(", ")} from "${m[4]}";`);
    origin.push(lineOf(text, m.index ?? 0));
  }
  return { text: `${lines.join("\n")}\nexport {};\n`, origin };
}

const IMPORT_ERRORS = new Set([2305, 2307, 2724, 2614, 2459, 2460]);

/** D0006, D0008, D0014 for skills `[{ name, text }]`: one program for every block. */
export function typeCheck(repo, skills) {
  const diags = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "docs-check-"));
  try {
    const scope = path.join(tmp, "node_modules", "@keel");
    fs.mkdirSync(scope, { recursive: true });
    for (const p of listPackages(repo)) fs.symlinkSync(p.dir, path.join(scope, p.name.replace(/^@keel\//, "")), "dir");
    for (const [link, target] of [
      ["vitest", path.join(repo, "node_modules/vitest")],
      ["@types", path.join(repo, "tooling/node_modules/@types")],
    ])
      if (fs.existsSync(target)) fs.symlinkSync(target, path.join(tmp, "node_modules", link), "dir");

    const files = new Map(); // absolute path -> { skill, name, origin (line map) | line }
    for (const { name, text } of skills) {
      const { blocks, diags: d } = blocksOf(name, text);
      diags.push(...d);
      for (const b of blocks) {
        fs.mkdirSync(path.join(tmp, name), { recursive: true });
        const abs = path.join(tmp, b.file);
        fs.writeFileSync(abs, b.text);
        files.set(abs, { name, line: b.line, kind: "block" });
      }
      const imp = keelImports(text);
      const abs = path.join(tmp, name, "imports.ts");
      fs.mkdirSync(path.join(tmp, name), { recursive: true });
      fs.writeFileSync(abs, imp.text);
      files.set(abs, { name, origin: imp.origin, kind: "imports" });
    }
    if (files.size === 0) return diags;

    const cfg = ts.readConfigFile(path.join(repo, "packages/compiler/tsconfig.strict.json"), ts.sys.readFile);
    const converted = ts.convertCompilerOptionsFromJson(cfg.config.compilerOptions, tmp);
    const options = { ...converted.options, jsxImportSource: "@keel/runtime-dom", noEmit: true };
    const program = ts.createProgram({ rootNames: [...files.keys()], options });
    for (const [abs, info] of files) {
      const sf = program.getSourceFile(abs);
      if (!sf) continue;
      for (const d of [...program.getSyntacticDiagnostics(sf), ...program.getSemanticDiagnostics(sf)]) {
        const message = ts.flattenDiagnosticMessageText(d.messageText, " ");
        const at = sf.getLineAndCharacterOfPosition(d.start ?? 0).line;
        if (info.kind === "imports") {
          diags.push(diag("D0008", skillFile(info.name), info.origin[at] ?? 1, `TS${d.code} ${message}`));
        } else if (IMPORT_ERRORS.has(d.code) && message.includes("@keel/")) continue;
        else diags.push(diag("D0006", skillFile(info.name), info.line + at, `TS${d.code} ${message}`));
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return diags;
}

/** Source files of the scaffold templates, by the path the scaffold writes. */
export const TEMPLATE_SOURCES = {
  "AGENTS.md": "packages/scaffold/src/templates/agentsBlock.ts",
  "CLAUDE.md": "packages/scaffold/src/agents/agentFiles.ts",
};

/**
 * The templates as a new project gets them, `[{ file, source, text }]`: `AGENTS.md` (the Keel block) and
 * `CLAUDE.md`, rendered with the given skills `[{ name, text }]`.
 */
export function templates(skills) {
  const rendered = agentFiles(
    new Map(),
    skills.map((s) => ({ name: s.name, description: frontmatter(s.text).description ?? "", text: s.text })),
  );
  if (!rendered.ok) return [];
  return Object.entries(TEMPLATE_SOURCES).flatMap(([file, source]) => {
    const text = rendered.value.find((f) => f.path === file)?.want;
    return typeof text === "string" ? [{ file, source, text: text.trimEnd() }] : [];
  });
}

/** A template diagnostic at its source file, on the source line holding the rendered line's text (else line 1). */
function atSource(repo, t, code, line, message) {
  const want = t.text.split("\n")[line - 1]?.trim() ?? "";
  const file = path.join(repo, t.source);
  const lines = want && fs.existsSync(file) ? read(file).split("\n") : [];
  const hit = lines.findIndex((l) => l.includes(want));
  return diag(code, t.source, hit === -1 ? 1 : hit + 1, `${message} in the ${t.file} template`);
}

/** D0015: cited codes against the known set, as D0009 checks a skill. */
export function checkTemplateCodes(repo, t, known) {
  return checkCodes(t.file, t.text, known).map((d) => atSource(repo, t, "D0015", d.line, d.message));
}

/** D0016: cited section ids that have no spec file, as D0010 checks a skill. */
export function checkTemplateSections(repo, t, ids) {
  return checkSections(t.file, t.text, ids).map((d) => atSource(repo, t, "D0016", d.line, d.message));
}

/** Repo-only names in a template: those of a skill, with `.claude/skills/` allowed. */
export const TEMPLATE_REPO_ONLY = [
  /\bpnpm spec\b/g,
  /--workspace\b/g,
  /(?<![\w@./-])(?:spec|docs|apps|packages)\//g,
  /(?<![\w@./-])\.claude\/(?!skills\/)/g,
];

/** D0017: repo-only paths and commands in a template. */
export function checkTemplateRepoOnly(repo, t) {
  const diags = [];
  for (const re of TEMPLATE_REPO_ONLY)
    for (const m of t.text.matchAll(re))
      diags.push(atSource(repo, t, "D0017", lineOf(t.text, m.index ?? 0), `repo-only name "${m[0]}"`));
  return diags;
}

/** D0018: the Keel block of `AGENTS.md` over the budget, in tokens (chars / 4). */
export function checkTemplateSize(repo, t, budget) {
  if (t.file !== "AGENTS.md" || budget === undefined) return [];
  const tokens = Math.ceil(t.text.length / 4);
  return tokens > budget ? [atSource(repo, t, "D0018", 0, `${tokens} tokens exceed docs.agents ${budget}`)] : [];
}

/** The `docs.agents` budget of a checkout's tooling/budgets.json. */
export function agentsBudget(repo) {
  const file = path.join(repo, "tooling/budgets.json");
  return fs.existsSync(file) ? JSON.parse(read(file)).output?.["docs.agents"] : undefined;
}

/** Checks of the scaffold templates, each `(repo, skills, { known, ids }) => diags`. */
export const templateChecks = [
  (repo, skills, { known, ids }) => {
    const budget = agentsBudget(repo);
    return templates(skills).flatMap((t) => [
      ...checkTemplateCodes(repo, t, known),
      ...checkTemplateSections(repo, t, ids),
      ...checkTemplateRepoOnly(repo, t),
      ...checkTemplateSize(repo, t, budget),
    ]);
  },
];

/** Every check over the published skills of a checkout. */
export function checkRepo(repo, names = Object.keys(TARGETS)) {
  const skills = names.map((name) => ({ name, text: read(path.join(repo, skillFile(name))) }));
  const known = knownCodes(repo);
  const ids = sectionIds(repo);
  const diags = [];
  for (const { name, text } of skills) {
    diags.push(
      ...checkShape(name, text),
      ...checkFragments(name, text),
      ...checkRepoOnly(name, text),
      ...checkCodes(name, text, known),
      ...checkSections(name, text, ids),
      ...checkCopy(repo, name),
    );
  }
  diags.push(...typeCheck(repo, skills));
  for (const check of templateChecks) diags.push(...check(repo, skills, { known, ids }));
  return { diags, skills };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = parseArgs();
  await run("docs-check", () => {
    const names = Object.keys(TARGETS);
    if (args.flags.has("write")) {
      writeCopies(root, names);
      return { diags: [], counts: { skills: names.length }, line: `ok docs-check wrote ${names.length} skill copies` };
    }
    const { diags, skills } = checkRepo(root, names);
    return { diags, counts: { skills: skills.length }, line: `ok docs-check ${skills.length} skills` };
  });
}
