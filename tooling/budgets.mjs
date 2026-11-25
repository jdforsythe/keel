import { spawnSync } from "node:child_process";
// Enforces tooling/budgets.json: output token budgets and package size budgets.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { build } from "esbuild";
import { buildDocs, listPackages, readSections } from "./docs-pack.mjs";
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
  if (out["mcp.tools-list"] !== undefined)
    measure("mcp.tools-list", "keel mcp tools/list", keel(["mcp"], '{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n'));

  // Installed docs (k.docs Budgets): every section's and skill's text, the AGENTS.md block, and the compact output
  // of `keel docs` and `keel docs --for E1451` in a project with every package installed, its docs packed in memory
  // from spec/ and tooling/docs-owners.json as `pnpm docs:pack` packs them.
  const skillsDir = path.join(root, "packages", "cli", "skills");
  const skillFiles = (fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir).sort() : [])
    .map((n) => ({ name: n, file: path.join(skillsDir, n, "SKILL.md") }))
    .filter((s) => fs.existsSync(s.file))
    .map((s) => ({ ...s, text: fs.readFileSync(s.file, "utf8") }));
  const sections = readSections(path.join(root, "spec"));
  if (out["docs.section"] !== undefined)
    for (const s of sections) {
      const t = tokens(s.text);
      measured++;
      if (t > out["docs.section"]) breach("docs.section", s.file, t, out["docs.section"], "tokens");
    }
  if (out["docs.skill"] !== undefined)
    for (const s of skillFiles) {
      const t = tokens(s.text);
      measured++;
      if (t > out["docs.skill"]) breach("docs.skill", relp(s.file), t, out["docs.skill"], "tokens");
    }
  if (out["docs.agents"] !== undefined) {
    const { agentFiles } = await import("../packages/scaffold/src/agents/index.ts");
    const skills = skillFiles.map((s) => ({ name: s.name, description: "", text: s.text }));
    const agents = agentFiles(new Map(), skills);
    const text = agents.ok ? (agents.value.find((f) => f.path === "AGENTS.md")?.want ?? "") : "";
    measure("docs.agents", "AGENTS.md Keel block", text.trimEnd());
  }
  if (out["docs.map"] !== undefined || out["docs.for"] !== undefined) {
    const { run: keelRun } = await import("../packages/cli/src/run.ts");
    const packages = listPackages(root);
    const owners = JSON.parse(fs.readFileSync(path.join(root, "tooling", "docs-owners.json"), "utf8"));
    const built = buildDocs(
      sections,
      owners,
      packages.map((p) => p.name),
    );
    const files = [
      {
        path: "package.json",
        source: JSON.stringify({ dependencies: Object.fromEntries(packages.map((p) => [p.name, "*"])) }),
      },
      ...packages.flatMap((p) => [
        {
          path: `node_modules/${p.name}/package.json`,
          source: fs.readFileSync(path.join(p.dir, "package.json"), "utf8"),
        },
        ...Object.entries(built.get(p.name) ?? {}).map(([rel, source]) => ({
          path: `node_modules/${p.name}/${rel}`,
          source,
        })),
      ]),
      ...skillFiles.map((s) => ({ path: `node_modules/@keel/cli/skills/${s.name}/SKILL.md`, source: s.text })),
    ];
    const docs = async (args) =>
      (await keelRun(["docs", ...args, "--format=compact"], { cwd: "/budget", files })).stdout;
    if (out["docs.map"] !== undefined) measure("docs.map", "keel docs", await docs([]));
    if (out["docs.for"] !== undefined) measure("docs.for", "keel docs --for E1451", await docs(["--for", "E1451"]));
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

  // Package size: the package's own code bundled from src/index.ts (minified esm, dependencies external), gzipped.
  // The tsc dist entry is a re-export file of ~100 bytes and measured nothing (backlog 0035).
  for (const [name, limit] of Object.entries(budgets.size ?? {})) {
    const max = typeof limit === "string" ? limit : limit.max;
    const platform = typeof limit === "string" ? "browser" : (limit.platform ?? "browser");
    const m = /^(\d+(?:\.\d+)?)\s*kb$/i.exec(max);
    // A subpath export (`@keel/router/match`) is its own entry: `packages/<pkg>/src/<subpath>/index.ts` (rfc:0071).
    const [pkg, ...sub] = name.replace(/^@keel\//, "").split("/");
    // A subpath with no folder index is the file `packages/<pkg>/src/<subpath>.ts` (`@keel/std-sessions/routes`, 0093).
    const nested = path.join(root, "packages", pkg, "src", ...sub, "index.ts");
    const file = path.join(root, "packages", pkg, "src", `${sub.join("/")}.ts`);
    // A library's `exports` entry names its source under `keel` (`./src/index.server.ts`, k.library-pack).
    const pj = path.join(root, "packages", pkg, "package.json");
    const target = fs.existsSync(pj)
      ? JSON.parse(fs.readFileSync(pj, "utf8")).exports?.[sub.length > 0 ? `./${sub.join("/")}` : "."]?.keel
      : undefined;
    const entry =
      typeof target === "string"
        ? path.join(root, "packages", pkg, target)
        : sub.length > 0 && !fs.existsSync(nested)
          ? file
          : nested;
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
