import { spawnSync } from "node:child_process";
// Builds tooling/ledger/ledger.json: every exported function in packages/*/src/*.ts and every export of apps/*/modules/** with its verification rung.
// Usage: node tooling/ledger.mjs [--diff|--ci] [--scope <prefix>]   (--diff compares to the committed ledger, prints E1706 on regression;
// --scope golden-1: limits --diff to items keyed with that prefix and counts only unsafe calls in the matching app, so unrelated drift cannot fail it)
// I/O shell only: rung rules are `ledger` and `ledgerDiff` from @keel/testing (k.testing Ledger), imported by path.
import fs from "node:fs";
import path from "node:path";
import { ledger } from "../packages/testing/src/ledger.ts";
import { ledgerDiff } from "../packages/testing/src/ledgerDiff.ts";
import { parseArgs, run } from "./output.ts";
import { mutationScore } from "./ledgerMutation.mjs";
import { CODE_EXT, rel, scrub, walk } from "./scan.mjs";

const root = path.join(import.meta.dirname, "..");
const LEDGER = "tooling/ledger/ledger.json";
const FN_DECL = /^export\s+(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)/;
const FN_CONST =
  /^export\s+const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:function\b|\(|[A-Za-z_$][\w$]*\s*=>)/;
const APP_EXPORT = /^export\s+(?:async\s+)?(?:const|let|function\*?|class)\s+([A-Za-z_$][\w$]*)/;
const APP_DEFAULT = /^export\s+default\b/;
/** A component's `Props` and `uses` belong to the component; module.ts and routes.ts are manifests, not items. */
const APP_PART_NAMES = new Set(["Props", "uses"]);
const APP_MANIFESTS = new Set(["module.ts", "routes.ts"]);
const TEST_FILE = /\.test\.(?:ts|tsx|mts)$/;
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
  found.push(...buildApps());
  found.sort((a, b) => (a.file + a.name).localeCompare(b.file + b.name));
  const records = ledger(found.map((e) => ({ item: `${e.file}#${e.name}`, evidence: e.evidence })));
  const exports = found.map((e, i) => ({ pkg: e.pkg, name: e.name, file: e.file, rung: records[i]?.rung ?? "none" }));
  /** Per-package mutation score (percent) from packages/<pkg>/reports/mutation/mutation.json, when a report exists. */
  const mutation = {};
  for (const pkg of pkgs) {
    const sc = mutationScore(path.join(pk, pkg));
    if (sc !== undefined) mutation[pkg] = sc;
  }
  return { version: 1, unsafe, ...(Object.keys(mutation).length > 0 ? { mutationScore: mutation } : {}), exports };
}

/** Items of `apps/<app>/modules/**`: keyed `<app>:<path under modules>#<name>`; evidence from `apps/<app>/test/**` and co-located tests. */
function buildApps() {
  const ap = path.join(root, "apps");
  const found = [];
  const apps = fs.existsSync(ap) ? fs.readdirSync(ap).sort() : [];
  for (const app of apps) {
    const modDir = path.join(ap, app, "modules");
    if (!fs.existsSync(modDir)) continue;
    const modFiles = walk(modDir).filter((f) => CODE_EXT.test(f));
    const verif = [...walk(path.join(ap, app, "test")), ...modFiles.filter((f) => TEST_FILE.test(f))]
      .filter((f) => CODE_EXT.test(f))
      .map((f) => {
        const s = fs.readFileSync(f, "utf8");
        return { s, ev: evidenceOf(s) };
      });
    for (const f of modFiles.filter((x) => !TEST_FILE.test(x) && !APP_MANIFESTS.has(path.basename(x)))) {
      const key = `${app}:${path.relative(modDir, f).split(path.sep).join("/")}`;
      for (const l of readCode(f)) {
        const m = APP_EXPORT.exec(l);
        const name = m ? m[1] : APP_DEFAULT.test(l) ? path.basename(f).split(".")[0] : null;
        if (!name || APP_PART_NAMES.has(name) || found.some((e) => e.file === key && e.name === name)) continue;
        const word = new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`);
        found.push({ pkg: app, name, file: key, evidence: verif.filter((v) => word.test(v.s)).map((v) => v.ev) });
      }
    }
  }
  return found;
}

function committed() {
  const r = spawnSync("git", ["show", `HEAD:${LEDGER}`], { cwd: root, encoding: "utf8" });
  if (r.status === 0) return JSON.parse(r.stdout);
  const p = path.join(root, LEDGER);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
}

const asRecords = (l) => l.exports.map((e) => ({ item: `${e.file}#${e.name}`, rung: e.rung }));

const args = parseArgs();
const scopeArg = args.values.get("scope");
const scope = typeof scopeArg === "string" ? scopeArg : "";
const inScope = (e) => `${e.file}#${e.name}`.startsWith(scope);

/** Unsafe calls in `apps/<app>/` for every app whose `<app>:` key prefix matches `scope`. */
function scopedUnsafe() {
  const ap = path.join(root, "apps");
  const apps = fs.existsSync(ap)
    ? fs.readdirSync(ap).filter((a) => `${a}:`.startsWith(scope) || scope.startsWith(`${a}:`))
    : [];
  let n = 0;
  for (const a of apps)
    for (const f of walk(path.join(ap, a)).filter((x) => CODE_EXT.test(x)))
      for (const l of readCode(f)) n += (l.match(UNSAFE_CALL) ?? []).length;
  return n;
}
const diff = args.flags.has("diff") || args.flags.has("ci");

await run("ledger", () => {
  const next = build();
  const diags = [];
  if (diff) {
    const prev = committed();
    if (prev) {
      const keep = (l) => ({ ...l, exports: l.exports.filter(inScope) });
      for (const d of ledgerDiff(asRecords(keep(prev)), asRecords(keep(next)))) {
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
      const before = scope === "" ? prev.unsafe : 0;
      const after = scope === "" ? next.unsafe : scopedUnsafe();
      if (after > before)
        diags.push({
          kind: "diag",
          code: "L0001",
          path: LEDGER,
          message: `unsafe count up ${before} -> ${after}`,
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
