import { spawnSync } from "node:child_process";
// Enforces tooling/budgets.json: output token budgets and package size budgets.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { run } from "./output.ts";

const root = path.join(import.meta.dirname, "..");
const budgets = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "budgets.json"), "utf8"));
const tokens = (s) => Math.ceil(s.length / 4);
const relp = (p) => path.relative(root, p).split(path.sep).join("/");

await run("budgets", () => {
  const diags = [];
  let measured = 0;
  let skipped = 0;
  const breach = (name, file, got, max, unit) =>
    diags.push({
      kind: "diag",
      code: unit === "tokens" ? "B0001" : "B0002",
      path: file,
      message: `${name} ${got} ${unit} exceeds budget ${max}`,
    });
  const out = budgets.output ?? {};

  const specDir = path.join(root, "spec", "kernel");
  if (out["spec.section"] !== undefined && fs.existsSync(specDir)) {
    for (const f of fs
      .readdirSync(specDir)
      .filter((n) => n.endsWith(".md"))
      .sort()) {
      const t = tokens(fs.readFileSync(path.join(specDir, f), "utf8"));
      measured++;
      if (t > out["spec.section"])
        breach("spec.section", relp(path.join(specDir, f)), t, out["spec.section"], "tokens");
    }
  }
  const map = path.join(root, "spec", "00-map.md");
  if (out["spec.map"] !== undefined && fs.existsSync(map)) {
    const t = tokens(fs.readFileSync(map, "utf8"));
    measured++;
    if (t > out["spec.map"]) breach("spec.map", relp(map), t, out["spec.map"], "tokens");
  }

  if (out["check.injected10"] !== undefined) {
    const r = spawnSync(
      process.execPath,
      ["tooling/structure-lint.mjs", "--format=compact", "--root", "tooling/fixtures/injected10"],
      { cwd: root, encoding: "utf8" },
    );
    const t = tokens(r.stdout);
    measured++;
    if (t > out["check.injected10"])
      breach("check.injected10", "tooling/fixtures/injected10", t, out["check.injected10"], "tokens");
  }

  if (out["test.failing3"] !== undefined) {
    const fixture = "tooling/fixtures/failing3";
    const hasConfig = fs
      .readdirSync(root)
      .some((n) => n.startsWith("vitest.config") || n.startsWith("vitest.workspace"));
    if (hasConfig && fs.existsSync(path.join(root, fixture, "vitest.config.ts"))) {
      const r = spawnSync("pnpm", ["exec", "vitest", "run", "--root", fixture], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, KEEL_AGENT: "1" },
      });
      const t = tokens(r.stdout);
      measured++;
      if (t > out["test.failing3"]) breach("test.failing3", fixture, t, out["test.failing3"], "tokens");
    } else skipped++;
  }

  for (const [name, limit] of Object.entries(budgets.size ?? {})) {
    const m = /^(\d+(?:\.\d+)?)\s*kb$/i.exec(limit);
    const dist = path.join(root, "packages", name.replace(/^@keel\//, ""), "dist", "index.js");
    if (!m || !fs.existsSync(dist)) continue;
    const bytes = zlib.gzipSync(fs.readFileSync(dist)).length;
    measured++;
    if (bytes > Number(m[1]) * 1024)
      breach(name, relp(dist), bytes, `${m[1]}kb (${Math.round(Number(m[1]) * 1024)} bytes)`, "bytes gzip");
  }

  return { diags, counts: skipped ? { measured, skipped } : { measured } };
});
