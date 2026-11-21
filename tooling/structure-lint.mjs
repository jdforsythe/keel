// Structure lint. S0001/S0002/S0004/S0005 delegate to @keel/check (E1752/E1757/E1754); S0003, S0006, S0012 (a stdlib file names a kernel `internal` entry `deps.json` does not list, k.parity) live here; S0009 (a std package's runtime entry reaches a CLI-time package) is std-entries.mjs. Usage: node tooling/structure-lint.mjs [--root dir] [--format=..] [--quiet] [--limit N]
import fs from "node:fs";
import path from "node:path";
import { check } from "../packages/check/src/index.ts";
import { parseArgs, run } from "./output.ts";
import { CODE_EXT, rel, scrub, walk } from "./scan.mjs";
import { stdEntryDiags } from "./std-entries.mjs";

const args = parseArgs();
const root = path.resolve(args.values.get("root") ?? path.join(import.meta.dirname, ".."));
const deps = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "deps.json"), "utf8"));
const order = deps.order;

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
  const skip = [path.join(root, "tooling", "fixtures"), path.join(root, "evals", "results")];
  const set = new Set();
  for (const d of dirs) for (const f of walk(d, skip)) if (CODE_EXT.test(f)) set.add(f);
  return [...set].sort();
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

// S0001/S0002/S0004/S0005: one implementation, @keel/check. The S-code stays in the message as an alias.
const ALIAS = { E1757: "S0004", E1754: "S0005" };
const SRC = /^packages\/[^/]+\/src\//;
const sources = files.map((f) => ({ path: rel(root, f), source: fs.readFileSync(f, "utf8") }));
const result = check(sources, { types: false, root });
for (const d of result.diagnostics) {
  const { fix: _fix, see: _see, ...rest } = d;
  const ok = (c) => d.code === c;
  let alias = ALIAS[d.code];
  if (ok("E1752") && SRC.test(d.path ?? "")) alias = d.message.startsWith("file ") ? "S0002" : "S0001";
  if (ok("E1756") || alias) diags.push({ ...rest, message: alias ? `${alias} ${d.message}` : d.message });
}

diags.push(...(await stdEntryDiags(root)).diags);

await run("structure-lint", () => ({ diags, counts: { files: files.length } }));
