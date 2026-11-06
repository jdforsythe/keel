import { spawnSync } from "node:child_process";
// Builds tooling/ledger/ledger.json: every exported function in packages/*/src/*.ts with its verification rung.
// Usage: node tooling/ledger.mjs [--diff|--ci]   (--diff compares to the committed ledger, prints E1706 on regression)
// I/O shell only: rung rules are `ledger` and `ledgerDiff` from @keel/testing (k.testing Ledger), imported by path.
import fs from "node:fs";
import path from "node:path";
import { ledger } from "../packages/testing/src/ledger.ts";
import { ledgerDiff } from "../packages/testing/src/ledgerDiff.ts";
import { parseArgs, run } from "./output.ts";
import { CODE_EXT, rel, scrub, walk } from "./scan.mjs";

const root = path.join(import.meta.dirname, "..");
const LEDGER = "tooling/ledger/ledger.json";
const FN_DECL = /^export\s+(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)/;
const FN_CONST =
  /^export\s+const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:function\b|\(|[A-Za-z_$][\w$]*\s*=>)/;
const UNSAFE_CALL = /(?<!function\s)\bunsafe\s*\(/g;
/** fast-check runs a property 100 times unless `numRuns` says otherwise. */
const FC_DEFAULT_RUNS = 100;
const readCode = (f) => scrub(fs.readFileSync(f, "utf8")).code;

/**
 * Evidence one test file gives (static scan; the file is assumed passing, as CI runs tests before the ledger):
 * a fast-check file is a property whose runs are its largest literal `numRuns` (else fast-check's default) and
 * whose seed is the first literal seed it states (`seed: n`, `SEED = n`, or a `Seed: n` header); otherwise an example.
 */
function evidenceOf(src) {
  if (!/fast-check/.test(src)) return { kind: "example", passed: true };
  const runs = [...src.matchAll(/\b(?:numRuns|runs)\s*:\s*(\d[\d_]*)/g)].map((m) => Number(m[1].replaceAll("_", "")));
  const seed = /\bseed\b\s*[:=]?\s*(-?\d+)/i.exec(src);
  return {
    kind: "property",
    passed: true,
    runs: runs.length === 0 ? FC_DEFAULT_RUNS : Math.max(...runs),
    ...(seed === null ? {} : { seed: Number(seed[1]) }),
  };
}

function build() {
  const pk = path.join(root, "packages");
  const found = [];
  let unsafe = 0;
  const pkgs = fs.existsSync(pk) ? fs.readdirSync(pk).sort() : [];
  for (const pkg of pkgs) {
    const base = path.join(pk, pkg);
    const verif = [...walk(path.join(base, "test")), ...walk(path.join(base, "conformance"))]
      .filter((f) => CODE_EXT.test(f))
      .map((f) => {
        const s = fs.readFileSync(f, "utf8");
        return { s, ev: evidenceOf(s) };
      });
    for (const f of [...walk(path.join(base, "src")), ...walk(path.join(base, "unsafe"))].filter((x) =>
      CODE_EXT.test(x),
    )) {
      for (const l of readCode(f)) unsafe += (l.match(UNSAFE_CALL) ?? []).length;
    }
    const srcDir = path.join(base, "src");
    if (!fs.existsSync(srcDir)) continue;
    for (const name of fs
      .readdirSync(srcDir)
      .filter((n) => n.endsWith(".ts"))
      .sort()) {
      const file = path.join(srcDir, name);
      for (const l of readCode(file)) {
        const m = FN_DECL.exec(l) ?? FN_CONST.exec(l);
        if (!m) continue;
        if (found.some((e) => e.file === rel(root, file) && e.name === m[1])) continue; // overload signatures
        const word = new RegExp(`\\b${m[1].replace(/\$/g, "\\$")}\\b`);
        const evidence = verif.filter((v) => word.test(v.s)).map((v) => v.ev);
        found.push({ pkg, name: m[1], file: rel(root, file), evidence });
      }
    }
  }
  found.sort((a, b) => (a.file + a.name).localeCompare(b.file + b.name));
  const records = ledger(found.map((e) => ({ item: `${e.file}#${e.name}`, evidence: e.evidence })));
  const exports = found.map((e, i) => ({ pkg: e.pkg, name: e.name, file: e.file, rung: records[i]?.rung ?? "none" }));
  return { version: 1, unsafe, exports };
}

function committed() {
  const r = spawnSync("git", ["show", `HEAD:${LEDGER}`], { cwd: root, encoding: "utf8" });
  if (r.status === 0) return JSON.parse(r.stdout);
  const p = path.join(root, LEDGER);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
}

const asRecords = (l) => l.exports.map((e) => ({ item: `${e.file}#${e.name}`, rung: e.rung }));

const args = parseArgs();
const diff = args.flags.has("diff") || args.flags.has("ci");

await run("ledger", () => {
  const next = build();
  const diags = [];
  if (diff) {
    const prev = committed();
    if (prev) {
      for (const d of ledgerDiff(asRecords(prev), asRecords(next))) {
        const [file, name] = d.item.split("#");
        diags.push({
          kind: "diag",
          code: d.code,
          path: file,
          line: 1,
          col: 1,
          message: `${name} rung lowered ${d.before} -> ${d.after}`,
          see: d.see,
        });
      }
      if (next.unsafe > prev.unsafe)
        diags.push({
          kind: "diag",
          code: "L0001",
          path: LEDGER,
          message: `unsafe count up ${prev.unsafe} -> ${next.unsafe}`,
        });
    }
  } else {
    const p = path.join(root, LEDGER);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, `${JSON.stringify(next, null, 2)}\n`);
  }
  const proven = next.exports.filter((e) => e.rung !== "none").length;
  return {
    diags,
    counts: { exports: next.exports.length, "proven/exhaustive/probabilistic/example": proven, unsafe: next.unsafe },
  };
});
