// Eval harness: `pnpm eval --task <name> [--model <id>] [--runner claude|none] [--max-iter N] [--skill <name>] [--strict]`
// or `pnpm eval --skill <name> [--runner claude|none]` for a skill eval (with --task, --skill names the skill to prepend;
// otherwise `tasks/<task>/task.json` { "skill" } or `keel-package-dev`).
import { execFile } from "node:child_process";
import { access, appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emit, mode } from "../tooling/output.ts";
import type { Diag, Summary } from "../tooling/output.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

type Runner = "claude" | "none";
type Args = { task?: string; model?: string; runner: Runner; maxIter: number; skill?: string; strict: boolean };
type Exec = { code: number; stdout: string };
type Usage = { input: number; output: number; costUsd: number; turns: number; durationMs: number; text: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const lastLine = (s: string): string => s.trim().split("\n").pop() ?? "";
const exists = (p: string): Promise<boolean> =>
  access(p).then(
    () => true,
    () => false,
  );

function parseArgs(argv: string[]): Args | string {
  const vals = new Map<string, string>();
  let strict = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--strict") strict = true;
    else if (a.startsWith("--format=")) continue;
    else if (a.startsWith("--")) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) return `missing value for ${a}`;
      vals.set(a.slice(2), v);
      i++;
    } else return `unexpected argument ${a}`;
  }
  const runnerRaw = vals.get("runner") ?? (vals.has("model") ? "claude" : "none");
  if (runnerRaw !== "claude" && runnerRaw !== "none") return "--runner must be claude|none";
  const maxIter = Number(vals.get("max-iter") ?? "5");
  if (!Number.isInteger(maxIter) || maxIter < 1) return "--max-iter must be a positive integer";
  const out: Args = { runner: runnerRaw, maxIter, strict };
  const task = vals.get("task");
  const model = vals.get("model");
  const skill = vals.get("skill");
  if (task !== undefined) out.task = task;
  if (model !== undefined) out.model = model;
  if (skill !== undefined) out.skill = skill;
  return out;
}

function run(cmd: string, args: string[]): Promise<Exec> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { cwd: root, maxBuffer: 256 * 1024 * 1024, env: { ...process.env, KEEL_AGENT: "1" } },
      (err, stdout) => {
        const code = err === null ? 0 : isRecord(err) && typeof err["code"] === "number" ? err["code"] : 1;
        resolve({ code, stdout: String(stdout) });
      },
    );
  });
}

async function callClaude(prompt: string, model: string | undefined): Promise<Usage> {
  const args = ["-p", "--output-format", "json", "--dangerously-skip-permissions", "--max-turns", "60"];
  if (model !== undefined) args.push("--model", model);
  // `--` ends the options: a prompt starting with SKILL.md frontmatter (`---`) is otherwise parsed as an unknown option.
  args.push("--", prompt);
  const { stdout } = await run("claude", args);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    parsed = undefined;
  }
  const j = isRecord(parsed) ? parsed : {};
  const logPath = process.env["KEEL_EVAL_LOG"];
  if (logPath !== undefined)
    await appendFile(logPath, `\n=== claude call ===\n${isRecord(parsed) ? String(j["result"] ?? "") : stdout}\n`);
  const u = isRecord(j["usage"]) ? j["usage"] : {};
  return {
    input: num(u["input_tokens"]) + num(u["cache_creation_input_tokens"]) + num(u["cache_read_input_tokens"]),
    output: num(u["output_tokens"]),
    costUsd: num(j["total_cost_usd"]),
    turns: num(j["num_turns"]),
    durationMs: num(j["duration_ms"]),
    text: typeof j["result"] === "string" ? j["result"] : "",
  };
}

async function countUnsafe(): Promise<number> {
  const dirs: string[] = [join(root, "unsafe")];
  const pk = join(root, "packages");
  if (await exists(pk)) for (const d of await readdir(pk)) dirs.push(join(pk, d, "src"));
  let n = 0;
  for (const dir of dirs) {
    if (!(await exists(dir))) continue;
    for (const f of await readdir(dir, { recursive: true })) {
      if (!/\.(ts|tsx|mts|mjs|js)$/.test(f)) continue;
      n += (await readFile(join(dir, f), "utf8").catch(() => "")).split("unsafe(").length - 1;
    }
  }
  return n;
}

const dateStamp = (now: Date): string => now.toISOString().slice(0, 10);

async function writeResult(name: string, data: Record<string, unknown>): Promise<void> {
  const dir = join(root, "evals", "results");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), JSON.stringify(data, null, 2) + "\n");
}

function print(diags: Diag[], trailer: string, ok: boolean, ms: number): void {
  if (mode() === "json") {
    const s: Summary = { kind: "summary", ok, counts: { diagnostics: diags.length }, ms };
    console.log(emit([...diags, s]));
    return;
  }
  const body = emit(diags);
  if (body !== "") console.log(body);
  console.log(trailer);
}

async function runTask(a: Args, task: string, now: Date, t0: number): Promise<boolean> {
  const dir = join(root, "evals", "tasks", task);
  const cfgPath = join(dir, "task.json");
  const cfgJson: unknown = (await exists(cfgPath)) ? JSON.parse(await readFile(cfgPath, "utf8")) : {};
  const cfgSkill = isRecord(cfgJson) && typeof cfgJson["skill"] === "string" ? cfgJson["skill"] : undefined;
  const skillName = a.skill ?? cfgSkill ?? "keel-package-dev";
  const taskMd = await readFile(join(dir, "TASK.md"), "utf8");
  const slice = await readFile(join(dir, "spec-slice.txt"), "utf8");
  const skillMd = await readFile(join(root, ".claude", "skills", skillName, "SKILL.md"), "utf8");
  const specSections = (slice.split("\n")[0] ?? "").split(/[\s,]+/).filter((x) => x !== "");
  const passMod: unknown = await import(pathToFileURL(join(dir, "pass.ts")).href);
  const passFn = isRecord(passMod) ? passMod["default"] : undefined;
  if (typeof passFn !== "function") throw new Error(`${task}/pass.ts has no default export`);

  const base = `${taskMd}\n\nSpec slice (retrieve with \`pnpm spec <topic>\`):\n${slice}\n\nSkill ${skillName}:\n${skillMd}`;
  let feedback = "";
  let input = 0;
  let output = 0;
  let costUsd = 0;
  let iterations = 0;
  let converged = false;
  let checkTrailer = "";
  let testTrailer = "";
  const maxIter = a.runner === "none" ? 1 : a.maxIter;

  while (iterations < maxIter && !converged) {
    iterations++;
    if (a.runner === "claude") {
      const prompt = feedback === "" ? base : `${base}\n\nPrevious iteration output:\n${feedback}`;
      const u = await callClaude(prompt, a.model);
      input += u.input;
      output += u.output;
      costUsd += u.costUsd;
    }
    const check = await run("pnpm", ["check", "--quiet"]);
    const test = await run("pnpm", ["test", "--quiet"]);
    checkTrailer = lastLine(check.stdout);
    testTrailer = lastLine(test.stdout);
    const passed: unknown = await Promise.resolve(passFn()).catch(() => false);
    converged = passed === true;
    if (!converged && iterations < maxIter) {
      const c = await run("pnpm", ["check"]);
      const t = await run("pnpm", ["test"]);
      feedback = `$ pnpm check\n${c.stdout}\n$ pnpm test\n${t.stdout}`;
    }
  }

  const unsafeCount = await countUnsafe();
  const durationMs = Math.round(performance.now() - t0);
  const modelName = a.runner === "none" ? "none" : (a.model ?? "default");
  await writeResult(`${dateStamp(now)}-${task}-${modelName}.json`, {
    task,
    skill: skillName,
    specSections,
    model: modelName,
    runner: a.runner,
    converged,
    iterations,
    tokens: { input, output },
    costUsd,
    unsafeCount,
    checkTrailer,
    testTrailer,
    durationMs,
    startedAt: now.toISOString(),
  });
  const diags: Diag[] = converged
    ? []
    : [
        {
          kind: "diag",
          code: "V0001",
          path: `evals/tasks/${task}`,
          message: `not converged after ${iterations} iteration(s)`,
        },
      ];
  print(
    diags,
    `ok eval ${task} converged=${converged} iter=${iterations} tokens=${input}/${output} unsafe=${unsafeCount} (${(durationMs / 1000).toFixed(1)}s)`,
    converged,
    durationMs,
  );
  return converged;
}

async function runSkill(a: Args, skill: string, now: Date, t0: number): Promise<boolean> {
  const diags: Diag[] = [];
  const fail = (message: string): void => {
    diags.push({ kind: "diag", code: "V0002", path: `.claude/skills/${skill}/SKILL.md`, message });
  };
  const specRaw = await readFile(join(root, "evals", "skills", `${skill}.json`), "utf8");
  const specJson: unknown = JSON.parse(specRaw);
  const spec = isRecord(specJson) ? specJson : {};
  const maxTokens = num(spec["maxTokens"]) || 600;
  const prompt = typeof spec["prompt"] === "string" ? spec["prompt"] : "";
  const expect = Array.isArray(spec["expect"]) ? spec["expect"].filter((x): x is string => typeof x === "string") : [];

  const file = join(root, ".claude", "skills", skill, "SKILL.md");
  const md = (await exists(file)) ? await readFile(file, "utf8") : undefined;
  let tokenEstimate = 0;
  let frontmatterOk = false;
  if (md === undefined) fail("SKILL.md missing");
  else {
    tokenEstimate = Math.ceil(md.length / 4);
    const fm = /^---\n([\s\S]*?)\n---/.exec(md)?.[1] ?? "";
    frontmatterOk = /^name:\s*\S/m.test(fm) && /^description:\s*\S/m.test(fm);
    if (!frontmatterOk) fail("frontmatter needs name and description");
    if (tokenEstimate > maxTokens) fail(`token estimate ${tokenEstimate} exceeds ${maxTokens}`);
  }

  let missing: string[] = [];
  let input = 0;
  let output = 0;
  let costUsd = 0;
  if (a.runner === "claude" && md !== undefined) {
    const u = await callClaude(`${md}\n\n${prompt}`, a.model);
    input = u.input;
    output = u.output;
    costUsd = u.costUsd;
    missing = expect.filter((s) => !u.text.includes(s));
    if (missing.length > 0) fail(`answer missing: ${missing.join(", ")}`);
  }

  const passed = diags.length === 0;
  const durationMs = Math.round(performance.now() - t0);
  await writeResult(`${dateStamp(now)}-skill-${skill}-${a.runner}.json`, {
    skill,
    runner: a.runner,
    model: a.runner === "none" ? "none" : (a.model ?? "default"),
    passed,
    tokenEstimate,
    maxTokens,
    frontmatterOk,
    missing,
    tokens: { input, output },
    costUsd,
    durationMs,
    startedAt: now.toISOString(),
  });
  print(
    diags,
    `${passed ? "ok" : "fail"} eval skill ${skill} passed=${passed} tokens~${tokenEstimate}/${maxTokens} (${(durationMs / 1000).toFixed(1)}s)`,
    passed,
    durationMs,
  );
  return passed;
}

async function main(now: Date): Promise<void> {
  const t0 = performance.now();
  const a = parseArgs(process.argv.slice(2));
  if (typeof a === "string") {
    console.log(emit([{ kind: "diag", code: "V0003", message: a }]));
    process.exitCode = 2;
    return;
  }
  let ok: boolean;
  if (a.task !== undefined) ok = await runTask(a, a.task, now, t0);
  else if (a.skill !== undefined) ok = await runSkill(a, a.skill, now, t0);
  else {
    console.log(emit([{ kind: "diag", code: "V0003", message: "need --task <name> or --skill <name>" }]));
    process.exitCode = 2;
    return;
  }
  if (!ok && a.strict) process.exitCode = 1;
}

await main(new Date());
