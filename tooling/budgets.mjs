import { spawnSync } from "node:child_process";
// Enforces tooling/budgets.json: output token budgets and package size budgets.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { build } from "esbuild";
import { run } from "./output.ts";

const root = path.join(import.meta.dirname, "..");
const budgets = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "budgets.json"), "utf8"));
const tokens = (s) => Math.ceil(s.length / 4);
const relp = (p) => path.relative(root, p).split(path.sep).join("/");

await run("budgets", async () => {
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

  // Kernel and stdlib sections share one budget (RFC 0047); spec/std/README.md is the index, not a section.
  for (const specDir of [path.join(root, "spec", "kernel"), path.join(root, "spec", "std")]) {
    if (out["spec.section"] === undefined || !fs.existsSync(specDir)) continue;
    for (const f of fs
      .readdirSync(specDir)
      .filter((n) => n.endsWith(".md") && n !== "README.md")
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

  const KEEL_BIN = "packages/cli/src/bin.ts";
  const agentEnv = { ...process.env, KEEL_AGENT: "1" };
  const measure = (key, where, text) => {
    const t = tokens(text);
    measured++;
    if (t > out[key]) breach(key, where, t, out[key], "tokens");
  };

  // A sibling of apps/golden-1 so tsconfig and @types resolve as they do for the real app; removed afterwards.
  // The real checker (keel check --format=compact) on a copy of golden app 1 with 10 injected kernel-rule violations.
  if (out["check.injected10"] !== undefined) {
    const fixture = "tooling/fixtures/injected10-app";
    const golden = path.join(root, "apps", "golden-1");
    const tmp = fs.mkdtempSync(path.join(root, "apps", ".injected10-"));
    try {
      const skip = new Set(["node_modules", "dist", ".turbo", ".keel"]);
      fs.cpSync(golden, tmp, { recursive: true, filter: (src) => !skip.has(path.basename(src)) });
      fs.cpSync(path.join(root, fixture), tmp, { recursive: true });
      fs.symlinkSync(path.join(golden, "node_modules"), path.join(tmp, "node_modules"));
      const r = spawnSync(process.execPath, [path.join(root, KEEL_BIN), "check", "--format=compact"], {
        cwd: tmp,
        encoding: "utf8",
        env: agentEnv,
      });
      measure("check.injected10", fixture, r.stdout);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  const keel = (args, input) =>
    spawnSync(process.execPath, [KEEL_BIN, ...args], { cwd: root, encoding: "utf8", env: agentEnv, input }).stdout;
  if (out.explain !== undefined) measure("explain", "keel explain E1451", keel(["explain", "E1451"]));
  if (out["spec.for"] !== undefined) measure("spec.for", "keel spec --for E1451", keel(["spec", "--for", "E1451"]));
  if (out["mcp.tools-list"] !== undefined)
    measure("mcp.tools-list", "keel mcp tools/list", keel(["mcp"], '{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n'));

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

  // Package size: the package's own code bundled from src/index.ts (minified esm, dependencies external), gzipped.
  // The tsc dist entry is a re-export file of ~100 bytes and measured nothing (backlog 0035).
  for (const [name, limit] of Object.entries(budgets.size ?? {})) {
    const max = typeof limit === "string" ? limit : limit.max;
    const platform = typeof limit === "string" ? "browser" : (limit.platform ?? "browser");
    const m = /^(\d+(?:\.\d+)?)\s*kb$/i.exec(max);
    const entry = path.join(root, "packages", name.replace(/^@keel\//, ""), "src", "index.ts");
    if (!m || !fs.existsSync(entry)) continue;
    const bundle = await build({
      entryPoints: [entry],
      bundle: true,
      minify: true,
      format: "esm",
      platform,
      packages: "external",
      write: false,
      logLevel: "silent",
    });
    const bytes = zlib.gzipSync(bundle.outputFiles[0].contents).length;
    measured++;
    if (bytes > Number(m[1]) * 1024)
      breach(name, relp(entry), bytes, `${m[1]}kb (${Math.round(Number(m[1]) * 1024)} bytes)`, "bytes gzip");
  }

  return { diags, counts: skipped ? { measured, skipped } : { measured } };
});
