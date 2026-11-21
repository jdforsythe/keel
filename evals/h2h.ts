// Head-to-head eval: an agent builds the same app (evals/headtohead/brief/BRIEF.md) in Keel and in Next.js; a hidden
// suite and two scans score each result against its URL.
//   pnpm eval:h2h --arm keel|next --agent claude|codex [--model <id>] [--max-iter N] [--keel-kit <dir>] [--next-version <v>] [--timeout-min N]
//   pnpm eval:h2h --dry <built-app-dir|stub>     scores a prebuilt app, no agent, nothing spent
//   pnpm eval:h2h --url <origin>                 scores an app that is already running
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { emit, mode } from "../tooling/output.ts";
import type { Diag, Summary } from "../tooling/output.ts";
import { type Agent, runAgent } from "./headtohead/agent.ts";
import { type Arm, build, prepare, stackVersion, start } from "./headtohead/arms.ts";
import { type Score, converged, scoreUrl } from "./headtohead/score.ts";
import { type Served, serve } from "./headtohead/serve.ts";
import { keelEntry } from "./headtohead/arms.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const here = join(root, "evals", "headtohead");

type Args =
  | {
      kind: "run";
      arm: Arm;
      agent: Agent;
      model?: string;
      maxIter: number;
      keelKit?: string;
      nextVersion: string;
      timeoutMin: number;
    }
  | { kind: "dry"; target: string }
  | { kind: "url"; origin: string };

function parseArgs(argv: string[]): Args | string {
  const vals = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a.startsWith("--format=")) continue;
    if (!a.startsWith("--")) return `unexpected argument ${a}`;
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) return `missing value for ${a}`;
    vals.set(a.slice(2), v);
    i++;
  }
  const dry = vals.get("dry");
  if (dry !== undefined) return { kind: "dry", target: dry };
  const url = vals.get("url");
  if (url !== undefined) return { kind: "url", origin: url };
  const arm = vals.get("arm");
  const agent = vals.get("agent");
  if (arm !== "keel" && arm !== "next") return "--arm must be keel|next (or use --dry <dir|stub>, --url <origin>)";
  if (agent !== "claude" && agent !== "codex") return "--agent must be claude|codex";
  const maxIter = Number(vals.get("max-iter") ?? "3");
  const timeoutMin = Number(vals.get("timeout-min") ?? "45");
  if (!Number.isInteger(maxIter) || maxIter < 1) return "--max-iter must be a positive integer";
  if (!Number.isFinite(timeoutMin) || timeoutMin <= 0) return "--timeout-min must be positive";
  const out: Args = { kind: "run", arm, agent, maxIter, timeoutMin, nextVersion: vals.get("next-version") ?? "latest" };
  const model = vals.get("model");
  const kit = vals.get("keel-kit");
  if (model !== undefined) out.model = model;
  if (kit !== undefined) out.keelKit = resolve(kit);
  return out;
}

const brief = (): Promise<string> => readFile(join(here, "brief", "BRIEF.md"), "utf8");

const preamble = (b: string): string =>
  `Build the app described in the brief below in the current directory, which already holds a project to start from. ` +
  `Nothing outside this directory is yours to read or change. Build it, run it, check it in a browser, then stop.\n\n${b}`;

function tally(s: Score): Record<string, unknown> {
  return {
    acceptance: {
      passed: s.acceptance.passed,
      total: s.acceptance.total,
      failed: s.acceptance.results.filter((r) => !r.passed).map((r) => ({ name: r.name, reason: r.reason })),
    },
    security: { defects: s.security.defects, checks: s.security.checks, found: s.security.found },
    a11y: { defects: s.a11y.defects, nodes: s.a11y.nodes, pages: s.a11y.pages, found: s.a11y.found },
  };
}

async function writeResult(name: string, data: Record<string, unknown>): Promise<void> {
  const dir = join(root, "evals", "results");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), `${JSON.stringify(data, null, 2)}\n`);
}

const slug = (s: string): string => s.replace(/[^A-Za-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "");

function print(s: Score, label: string, extra: string, ok: boolean, ms: number): void {
  const diags: Diag[] = [
    ...s.acceptance.results
      .filter((r) => !r.passed)
      .map((r): Diag => ({ kind: "diag", code: "V0004", path: r.name, message: r.reason.slice(0, 89) })),
    ...s.security.found.map((d): Diag => ({ kind: "diag", code: "V0005", path: d.id, message: d.detail.slice(0, 89) })),
    ...s.a11y.found.map((d): Diag => ({ kind: "diag", code: "V0006", path: d.id, message: d.detail.slice(0, 89) })),
  ];
  if (mode() === "json") {
    const sum: Summary = { kind: "summary", ok, counts: { diagnostics: diags.length }, ms };
    console.log(emit([...diags, sum]));
    return;
  }
  const body = emit(diags);
  if (body !== "") console.log(body);
  console.log(
    `ok h2h ${label} converged=${converged(s)} accept=${s.acceptance.passed}/${s.acceptance.total} security=${s.security.defects} a11y=${s.a11y.defects}${extra} (${(ms / 1000).toFixed(1)}s)`,
  );
}

/** Serves a prebuilt app (a built Keel app directory, or the stub) and scores it. */
async function dry(target: string, now: Date, t0: number): Promise<Score> {
  const scratch = await mkdtemp(join(tmpdir(), "h2h-dry-"));
  let served: Served;
  let label: string;
  if (target === "stub") {
    label = "stub";
    served = await serve("node", [join(here, "stub", "server.mjs")], here, {});
  } else {
    const dir = isAbsolute(target) ? target : resolve(root, target);
    const entry = await keelEntry(dir);
    if (entry === undefined) throw new Error(`${target} has no dist/*/server.mjs: build it first`);
    label = dir.split("/").pop() ?? "app";
    const secret = "d".repeat(40);
    served = await serve(
      "node",
      [
        "--experimental-webstorage",
        `--localstorage-file=${join(scratch, "storage")}`,
        "--disable-warning=ExperimentalWarning",
        entry,
      ],
      dir,
      { KEEL_SECRET: secret, BETTER_AUTH_SECRET: secret, AUTH_DATABASE_PATH: join(scratch, "auth.sqlite") },
    );
  }
  try {
    const s = await scoreUrl(served.origin, root);
    const ms = Math.round(performance.now() - t0);
    await writeResult(`${now.toISOString().slice(0, 10)}-h2h-${slug(label)}-dry.json`, {
      task: "h2h-recipe-box",
      arm: label,
      skill: "none",
      specSections: [],
      model: "none",
      runner: "dry",
      converged: converged(s),
      iterations: 0,
      tokens: { input: 0, output: 0 },
      tokensToGreen: null,
      costUsd: 0,
      durationMs: ms,
      startedAt: now.toISOString(),
      ...tally(s),
    });
    print(s, label, " tokens=0/0", converged(s), ms);
    return s;
  } finally {
    await served.stop();
    await rm(scratch, { recursive: true, force: true });
  }
}

async function runArm(a: Extract<Args, { kind: "run" }>, now: Date, t0: number): Promise<void> {
  const parent = await mkdtemp(join(tmpdir(), `h2h-${a.arm}-`));
  const scratch = await mkdtemp(join(tmpdir(), "h2h-data-"));
  const prepared = await prepare(a.arm, parent, root, {
    nextVersion: a.nextVersion,
    ...(a.keelKit === undefined ? {} : { keelKit: a.keelKit }),
  });
  const text = preamble(await brief());
  let input = 0;
  let output = 0;
  let costUsd = 0;
  let iterations = 0;
  let buildOk = false;
  let score: Score | undefined;
  let feedback = "";
  let timedOut = false;
  let scoreMs = 0;
  while (iterations < a.maxIter && (score === undefined || !converged(score))) {
    iterations++;
    const prompt = feedback === "" ? text : `${text}\n\nYour previous attempt did not pass. ${feedback}`;
    const u = await runAgent(a.agent, prepared.dir, prompt, a.model, a.timeoutMin * 60_000);
    input += u.input;
    output += u.output;
    costUsd += u.costUsd;
    timedOut = timedOut || u.timedOut;
    const built = await build(a.arm, prepared.dir);
    buildOk = built.ok;
    if (!built.ok) {
      feedback = `The build failed:\n${built.output}`;
      score = undefined;
      continue;
    }
    let served: Served | undefined;
    try {
      served = await start(a.arm, prepared.dir, scratch);
    } catch (e) {
      feedback = `The server did not start: ${e instanceof Error ? e.message : String(e)}`;
      score = undefined;
      continue;
    }
    try {
      const t1 = performance.now();
      score = await scoreUrl(served.origin, root);
      scoreMs += Math.round(performance.now() - t1);
    } finally {
      await served.stop();
      await rm(join(scratch, "storage"), { force: true });
    }
    // The hidden suite stays hidden: the agent hears how many checks failed, never which.
    feedback = `${score.acceptance.total - score.acceptance.passed} of ${score.acceptance.total} acceptance checks failed.`;
  }
  const ms = Math.round(performance.now() - t0);
  const isGreen = score !== undefined && converged(score);
  const model = a.model ?? "default";
  const shown: Score = score ?? {
    acceptance: { passed: 0, total: 0, results: [] },
    security: { defects: 0, checks: 0, found: [] },
    a11y: { defects: 0, nodes: 0, pages: 0, found: [] },
  };
  await writeResult(`${now.toISOString().slice(0, 10)}-h2h-${a.arm}-${a.agent}-${slug(model)}.json`, {
    task: "h2h-recipe-box",
    arm: a.arm,
    agent: a.agent,
    stack: await stackVersion(a.arm, prepared.dir),
    start: prepared.note,
    skill: a.arm === "keel" ? "published" : "none",
    specSections: [],
    model,
    runner: a.agent,
    converged: isGreen,
    iterations,
    tokens: { input, output },
    tokensToGreen: isGreen ? input + output : null,
    costUsd,
    builds: buildOk,
    timedOut,
    durationMs: ms - scoreMs,
    scoreMs,
    startedAt: now.toISOString(),
    ...tally(shown),
  });
  print(shown, a.arm, ` iter=${iterations} tokens=${input}/${output}`, isGreen, ms);
  await rm(scratch, { recursive: true, force: true });
  await rm(parent, { recursive: true, force: true });
  if (prepared.madeKit !== undefined) await rm(prepared.madeKit, { recursive: true, force: true });
}

async function main(now: Date): Promise<void> {
  const t0 = performance.now();
  const a = parseArgs(process.argv.slice(2));
  if (typeof a === "string") {
    console.log(emit([{ kind: "diag", code: "V0003", message: a }]));
    process.exitCode = 2;
    return;
  }
  try {
    if (a.kind === "dry") await dry(a.target, now, t0);
    else if (a.kind === "url") {
      const s = await scoreUrl(a.origin, root);
      print(s, "url", "", converged(s), Math.round(performance.now() - t0));
    } else await runArm(a, now, t0);
  } catch (e) {
    console.log(
      emit([
        {
          kind: "diag",
          code: "V0007",
          message: (e instanceof Error ? e.message : String(e)).split("\n")[0]?.slice(0, 89) ?? "failed",
        },
      ]),
    );
    process.exitCode = 1;
  }
}

await main(new Date());
