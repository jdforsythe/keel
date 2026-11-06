// Structure lint (S0001-S0006). Usage: node tooling/structure-lint.mjs [--root dir] [--format=..] [--quiet] [--limit N]
import fs from "node:fs";
import path from "node:path";
import { parseArgs, run } from "./output.ts";
import { CODE_EXT, rel, scrub, walk } from "./scan.mjs";

const args = parseArgs();
const root = path.resolve(args.values.get("root") ?? path.join(import.meta.dirname, ".."));
const deps = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "deps.json"), "utf8"));
const order = deps.order;

const TS_DIRECTIVE = new RegExp(`@ts-${"(?:ignore|expect-error)"}`);
const CAST = /\bas\s+(?!const\b)[A-Za-z_{(\[]/;
const ANY = /(?:[:<,|&(]\s*|\bas\s+)any\b(?!\w)|\bany\[\]/;
const NONNULL = /[\w)\]]!(?:\.|\[)/;
const CLOCK = /\bDate\.now\b|\bnew Date\(|\bMath\.random\b|\bperformance\.now\b/;
const UNSAFE_CALL = /(?<!function\s)\bunsafe\s*\(\s*(.*)$/;
const EXPORT_DECL =
  /^export\s+(?:declare\s+)?(?:default\s+)?(?:abstract\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|type|interface|enum|namespace)\s+([A-Za-z_$][\w$]*)/;
const EXPORT_DEFAULT_NAMED = /^export\s+default\s+(?:async\s+)?(?:function\*?|class)\s+([A-Za-z_$][\w$]*)/;

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

function topLevelExports(codeLines) {
  const names = new Set();
  let reexport = false;
  codeLines.forEach((l) => {
    if (!l.startsWith("export")) return;
    if (
      /^export\s*(?:type\s*)?\*/.test(l) ||
      /^export\s*(?:type\s*)?\{[^}]*\}\s*from\b/.test(l) ||
      /^export\s*(?:type\s*)?\{[^}]*$/.test(l)
    ) {
      reexport = true;
      return;
    }
    const list = /^export\s*(?:type\s*)?\{([^}]*)\}/.exec(l);
    if (list) {
      for (const part of list[1].split(",")) {
        const n = part
          .trim()
          .split(/\s+as\s+/)
          .pop();
        if (n) names.add(n);
      }
      return;
    }
    const d = EXPORT_DEFAULT_NAMED.exec(l) ?? EXPORT_DECL.exec(l);
    if (d) names.add(d[1]);
    else if (/^export\s+default\b/.test(l)) names.add("default");
  });
  return { names: [...names], reexport };
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

  // S0001 / S0002: src files only
  if (isPkg && area === "src" && base !== "index.ts" && base !== "index.tsx" && !base.endsWith(".d.ts")) {
    const { names, reexport } = topLevelExports(code);
    if (reexport) add("S0001", file, 1, 1, "re-export outside index.ts");
    else if (names.length > 1)
      add("S0001", file, 1, 1, `${names.length} exports in one file (${names.join(", ")}); split it`);
    else if (names.length === 1 && names[0] !== "default") {
      const stem = base.replace(/\.[^.]+$/, "");
      if (names[0] !== stem) add("S0002", file, 1, 1, `file ${stem} exports ${names[0]}; rename to match`);
    }
  }

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

  const inUnsafe = isPkg && area === "unsafe";
  const inTest = isPkg && (area === "test" || area === "conformance");
  const isImportLine = (l) => /^\s*(?:import|export)\b/.test(l);

  code.forEach((l, i) => {
    if (!inUnsafe) {
      const checks = [
        [CAST, "type cast with as"],
        [ANY, "any is banned outside unsafe/"],
        [NONNULL, "non-null assertion outside unsafe/"],
      ];
      for (const [re, msg] of checks) {
        if (re === CAST && isImportLine(l)) continue;
        const m = re.exec(l);
        if (m) add("S0004", file, i + 1, m.index + 1, msg);
      }
      const d = TS_DIRECTIVE.exec(raw[i] ?? "");
      if (d && !/^\s*['"`]/.test((raw[i] ?? "").slice(0, d.index)))
        add("S0004", file, i + 1, d.index + 1, "ts suppression directive outside unsafe/");
    }
    if (inTest) {
      const m = CLOCK.exec(l);
      if (m) add("S0006", file, i + 1, m.index + 1, `nondeterministic ${m[0]} in tests; inject a clock/seed`);
    }
  });

  // S0005: unsafe(...) needs a non-empty string literal justification
  text.forEach((l, i) => {
    const m = UNSAFE_CALL.exec(l);
    if (!m) return;
    const rest = m[1] === "" ? (text[i + 1] ?? "").trim() : m[1];
    if (!/^(?:'[^']|"[^"]|`[^`])/.test(rest))
      add("S0005", file, i + 1, m.index + 1, "unsafe call needs a non-empty string justification");
  });
}

await run("structure-lint", () => ({ diags, counts: { files: files.length } }));
