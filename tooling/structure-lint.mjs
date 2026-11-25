// Structure lint. S0001/S0002/S0004/S0005 delegate to @keel/check (E1752/E1757/E1754), and E1760 and E1761 pass through; S0014 (an `unsafe(` call in `packages/*` whose lifted range holds no E1757 finding, or in a library's package no finding of a lifted code, k.unsafe), S0003, S0006, S0012 (a stdlib file names a kernel `internal` entry `deps.json` does not list, k.parity) live here; S0015 (a fast-check run with no seed, in the scanned files, conformance included, and every app's and example's test files) is unseeded-properties.mjs; S0009 (a std package's runtime entry reaches a CLI-time package) is std-entries.mjs. Usage: node tooling/structure-lint.mjs [--root dir] [--format=..] [--quiet] [--limit N]
import fs from "node:fs";
import path from "node:path";
import { Visitor } from "oxc-parser";
import { check } from "../packages/check/src/index.ts";
import { LIFTED_CODES } from "../packages/check/src/internal/LIFTED_CODES.ts";
import { liftedRanges } from "../packages/check/src/internal/liftedRanges.ts";
import { parseFile } from "../packages/check/src/internal/parseFile.ts";
import { noUnsafeSyntax } from "../packages/check/src/rules/noUnsafeSyntax.ts";
import { parseArgs, run } from "./output.ts";
import { CODE_EXT, rel, scrub, walk } from "./scan.mjs";
import { stdEntryDiags } from "./std-entries.mjs";
import { unseededProperties } from "./unseeded-properties.mjs";

const args = parseArgs();
const root = path.resolve(args.values.get("root") ?? path.join(import.meta.dirname, ".."));
const deps = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "deps.json"), "utf8"));
const order = deps.order;

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;
const CLOCK = /\bDate\.now\b|\bnew Date\(|\bMath\.random\b|\bperformance\.now\b/;

/** Collect scan targets. */
function targets() {
  const dirs = [];
  const pk = path.join(root, "packages");
  if (fs.existsSync(pk)) {
    for (const p of fs.readdirSync(pk))
      for (const d of ["src", "unsafe", "test", "conformance"]) dirs.push(path.join(pk, p, d));
  }
  dirs.push(path.join(root, "tooling"), path.join(root, "evals"));
  const skip = [
    path.join(root, "tooling", "fixtures"),
    path.join(root, "evals", "results"),
    path.join(root, "packages", "cli", "conformance", "unsafe", "review-fixtures"),
  ];
  const set = new Set();
  for (const d of dirs) for (const f of walk(d, skip)) if (CODE_EXT.test(f)) set.add(f);
  return [...set].sort();
}

/** Every app's and example's test files (S0015 only). */
function appTests() {
  const out = [];
  for (const top of ["apps", "examples"]) {
    const dir = path.join(root, top);
    if (!fs.existsSync(dir)) continue;
    for (const f of walk(dir)) if (TEST_FILE.test(f)) out.push(f);
  }
  return out.sort();
}

const diags = [];
const add = (code, file, line, col, message) =>
  diags.push({ kind: "diag", code, path: rel(root, file), line, col, message });
const files = targets();

for (const file of files) {
  const r = rel(root, file);
  const segs = r.split("/");
  const isPkg = segs[0] === "packages";
  const pkg = isPkg ? segs[1] : undefined;
  const area = isPkg ? segs[2] : segs[0];
  const base = path.basename(file);
  const src = fs.readFileSync(file, "utf8");
  const { code, text } = scrub(src);
  const raw = src.split("\n");

  // S0003: downward-only imports within packages
  if (isPkg && pkg) {
    const me = order.indexOf(pkg);
    text.forEach((l, i) => {
      // Only real import/export statements or require() calls at statement start; not package names inside template strings.
      const m =
        /^\s*(?:import|export)\b[^'"`]*?\bfrom\s*['"]@keel\/([\w-]+)|^\s*import\s*['"]@keel\/([\w-]+)|\brequire\(\s*['"]@keel\/([\w-]+)|\bimport\(\s*['"]@keel\/([\w-]+)/.exec(
          l,
        );
      if (!m) return;
      const target0 = m[1] ?? m[2] ?? m[3] ?? m[4];
      if (!target0) return;
      const target = target0;
      if (target === "ctx" || target === "tooling" || target === pkg) return;
      const ti = order.indexOf(target);
      if (me >= 0 && ti > me)
        add("S0003", file, i + 1, (m.index ?? 0) + 1, `${pkg} may not import ${target} (later in deps order)`);
    });
  }

  // S0012: the stdlib reaches the kernel through public entries only (k.parity), but for the entries deps.json lists.
  if (isPkg && pkg?.startsWith("std-") && (area === "src" || area === "unsafe")) {
    const allowed = deps.internal?.[pkg] ?? [];
    text.forEach((l, i) => {
      const re = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\(\s*)['"](@keel\/([\w-]+)(?:\/[^'"]*)?)['"]/g;
      for (let m = re.exec(l); m; m = re.exec(l)) {
        const [, spec, target] = m;
        if (!spec || !target || target.startsWith("std-") || !order.includes(target)) continue;
        if (!spec.split("/").slice(2).includes("internal") || allowed.includes(spec)) continue;
        add(
          "S0012",
          file,
          i + 1,
          m.index + 1,
          `${pkg} may not import ${spec}: the stdlib holds no power a library lacks (k.parity)`,
        );
      }
    });
  }

  const inTest = isPkg && (area === "test" || area === "conformance");
  if (inTest) {
    code.forEach((l, i) => {
      const m = CLOCK.exec(l);
      if (m) add("S0006", file, i + 1, m.index + 1, `nondeterministic ${m[0]} in tests; inject a clock/seed`);
    });
  }
}

// S0015: a fast-check run with no seed (unseeded-properties.mjs).
for (const file of [...files, ...appTests()]) {
  const src = fs.readFileSync(file, "utf8");
  if (!src.includes("fast-check")) continue;
  for (const d of unseededProperties(src, file)) add("S0015", file, d.line, d.col, d.message);
}

/** Whether `packages/<name>/` of a repository path is a library (`"keel": "library"` in its `package.json`, k.library). */
function inLibrary(p) {
  const m = /^packages\/[^/]+\//.exec(p);
  if (!m) return false;
  const manifest = path.join(root, m[0], "package.json");
  if (!fs.existsSync(manifest)) return false;
  try {
    return JSON.parse(fs.readFileSync(manifest, "utf8")).keel === "library";
  } catch {
    return false;
  }
}

/**
 * S0014 (k.unsafe): in a kernel package only E1757 of the lifted codes is enforced, so `unsafe/` holds type-system
 * escapes; in a library's package the app's reading enforces every lifted code, so a finding of any of them counts.
 * An `unsafe(` call whose lifted range holds no such finding (or that has no range) escapes nothing checked.
 */
function s0014(file) {
  const parsed = parseFile(file);
  if (!parsed.ok) return;
  const starts = [0];
  for (let i = 0; i < file.source.length; i++) if (file.source[i] === "\n") starts.push(i + 1);
  const at = (f) => (starts[f.line - 1] ?? 0) + f.col - 1;
  const escapes = noUnsafeSyntax.check({ file, ast: parsed.program, artifacts: {}, project: [file] }).map(at);
  if (file.source.includes("unsafe(") && inLibrary(file.path)) {
    // The app's reading of the file, its `unsafe/` segments renamed so no lifted range drops a finding.
    const seen = { path: file.path.replace(/(^|\/)unsafe\//g, "$1lifted/"), source: file.source };
    for (const d of check([seen], { types: false }).diagnostics) if (LIFTED_CODES.has(d.code)) escapes.push(at(d));
  }
  const ranges = liftedRanges(file);
  new Visitor({
    CallExpression: (n) => {
      if (n.callee.type !== "Identifier" || n.callee.name !== "unsafe") return;
      const range = ranges.find(([a, b]) => a >= n.start && b <= n.end);
      if (range !== undefined && escapes.some((at) => at >= range[0] && at < range[1])) return;
      const line = starts.findLastIndex((st) => st <= n.start);
      add(
        "S0014",
        path.join(root, file.path),
        line + 1,
        n.start - (starts[line] ?? 0) + 1,
        "unsafe() call holds no cast, !, any or ts-suppression; make it ordinary code in src/",
      );
    },
  }).visit(parsed.program);
}

// S0001/S0002/S0004/S0005: one implementation, @keel/check. The S-code stays in the message as an alias. E1760 and
// E1761 (k.unsafe) keep their own codes.
const ALIAS = { E1757: "S0004", E1754: "S0005" };
const PASS = new Set(["E1756", "E1760", "E1761"]);
const SRC = /^packages\/[^/]+\/src\//;
const sources = files.map((f) => ({ path: rel(root, f), source: fs.readFileSync(f, "utf8") }));
for (const f of sources) if (f.path.startsWith("packages/")) s0014(f);
const result = check(sources, { types: false, root });
for (const d of result.diagnostics) {
  const { fix: _fix, see: _see, ...rest } = d;
  const ok = (c) => d.code === c;
  let alias = ALIAS[d.code];
  if (ok("E1752") && SRC.test(d.path ?? "")) alias = d.message.startsWith("file ") ? "S0002" : "S0001";
  if (PASS.has(d.code) || alias) diags.push({ ...rest, message: alias ? `${alias} ${d.message}` : d.message });
}

diags.push(...(await stdEntryDiags(root)).diags);

await run("structure-lint", () => ({ diags, counts: { files: files.length } }));
