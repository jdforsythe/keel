import { spawnSync } from "node:child_process";
// Builds tooling/ledger/ledger.json: every exported function in packages/*/src/*.ts with its verification rung.
// Usage: node tooling/ledger.mjs [--diff|--ci]   (--diff compares to the committed ledger, prints L0001 on regression)
import fs from "node:fs";
import path from "node:path";
import { parseArgs, run } from "./output.ts";
import { CODE_EXT, rel, scrub, walk } from "./scan.mjs";

const root = path.join(import.meta.dirname, "..");
const LEDGER = "tooling/ledger/ledger.json";
const RUNGS = ["none", "example", "probabilistic", "exhaustive", "proven"];
const FN_DECL = /^export\s+(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)/;
const FN_CONST =
  /^export\s+const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:function\b|\(|[A-Za-z_$][\w$]*\s*=>)/;
const UNSAFE_CALL = /(?<!function\s)\bunsafe\s*\(/g;
const readCode = (f) => scrub(fs.readFileSync(f, "utf8")).code;

function build() {
  const pk = path.join(root, "packages");
  const entries = [];
  let unsafe = 0;
  const pkgs = fs.existsSync(pk) ? fs.readdirSync(pk).sort() : [];
  for (const pkg of pkgs) {
    const base = path.join(pk, pkg);
    const verif = [...walk(path.join(base, "test")), ...walk(path.join(base, "conformance"))]
      .filter((f) => CODE_EXT.test(f))
      .map((f) => {
        const s = fs.readFileSync(f, "utf8");
        return { s, prop: /fast-check/.test(s) };
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
        const word = new RegExp(`\\b${m[1].replace(/\$/g, "\\$")}\\b`);
        const hits = verif.filter((v) => word.test(v.s));
        const rung = hits.some((v) => v.prop) ? "probabilistic" : hits.length ? "example" : "none";
        entries.push({ pkg, name: m[1], file: rel(root, file), rung });
      }
    }
  }
  entries.sort((a, b) => (a.file + a.name).localeCompare(b.file + b.name));
  return { version: 1, unsafe, exports: entries };
}

function committed() {
  const r = spawnSync("git", ["show", `HEAD:${LEDGER}`], { cwd: root, encoding: "utf8" });
  if (r.status === 0) return JSON.parse(r.stdout);
  const p = path.join(root, LEDGER);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
}

const args = parseArgs();
const diff = args.flags.has("diff") || args.flags.has("ci");

await run("ledger", () => {
  const next = build();
  const diags = [];
  if (diff) {
    const prev = committed();
    if (prev) {
      const before = new Map(prev.exports.map((e) => [`${e.file}#${e.name}`, e]));
      for (const e of next.exports) {
        const old = before.get(`${e.file}#${e.name}`);
        if (old && RUNGS.indexOf(e.rung) < RUNGS.indexOf(old.rung))
          diags.push({
            kind: "diag",
            code: "L0001",
            path: e.file,
            line: 1,
            col: 1,
            message: `${e.name} rung lowered ${old.rung} -> ${e.rung}`,
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
