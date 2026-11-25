// The public mode of an eval task (`task.json` `"docs": "public"`): the agent builds in a fresh project outside the
// repository from the packed `@keel/*` kit, reading what a public user's agent reads; the harness then imports the
// project into `apps/<name>/` and the task's own `pass.ts` judges it from the repository root.
import { access, copyFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { callClaude } from "./agent.ts";
import { importApp } from "./importApp.ts";
import { PROBE_PROMPT, audit, probe, replyFindings } from "./isolation.ts";
import type { Finding } from "./isolation.ts";
import { ensureKit, repoRoot } from "./pack.ts";
import { setupProject } from "./project.ts";
import { isRecord, sh } from "./run.ts";

export type PublicTask = {
  name: string;
  /** `task.json` `import.scripts`: the workspace form of the app's scripts. */
  scripts: Readonly<Record<string, string>>;
};

export type PublicRun = {
  runner: "claude" | "none";
  model: string | undefined;
  maxIter: number;
  /** `--keel-kit`; a fresh pack when absent. */
  kit: string | undefined;
  /** Judges the imported app: the task's `pass.ts` default export. */
  pass: () => unknown;
};

export type PublicResult = {
  converged: boolean;
  iterations: number;
  input: number;
  output: number;
  costUsd: number;
  checkExit: number;
  testExit: number;
  checkTrailer: string;
  testTrailer: string;
  findings: Finding[];
  probe: "clean" | "failed";
  audit: "clean" | "failed" | "skipped";
  packed: string[];
};

const lastLine = (s: string): string => s.trim().split("\n").pop() ?? "";

/** The `task.json` fields of a public task: `import.scripts` as strings. */
export function publicTask(name: string, cfg: unknown): PublicTask {
  const imp = isRecord(cfg) && isRecord(cfg["import"]) ? cfg["import"] : {};
  const raw = isRecord(imp["scripts"]) ? imp["scripts"] : {};
  const scripts = Object.fromEntries(
    Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
  return { name, scripts };
}

async function packedVersions(kit: string): Promise<string[]> {
  return (await readdir(kit))
    .filter((f) => f.endsWith(".tgz"))
    .map((f) => f.replace(/^keel-/, "@keel/").replace(/-(\d[^/]*)\.tgz$/, "@$1"))
    .sort();
}

const exists = (p: string): Promise<boolean> =>
  access(p).then(
    () => true,
    () => false,
  );

/** Runs one public task end to end. Removes its project, and the kit it packed, when it ends. */
export async function runPublic(task: PublicTask, run: PublicRun, taskDir: string): Promise<PublicResult> {
  const { kit, made } = await ensureKit(repoRoot, run.kit);
  const project = await setupProject(kit, task.name);
  const target = join(repoRoot, "apps", task.name);
  const result: PublicResult = {
    converged: false,
    iterations: 0,
    input: 0,
    output: 0,
    costUsd: 0,
    checkExit: 0,
    testExit: 0,
    checkTrailer: "",
    testTrailer: "",
    findings: [],
    probe: "clean",
    audit: run.runner === "claude" ? "clean" : "skipped",
    packed: await packedVersions(kit),
  };
  try {
    result.findings.push(...(await probe(project.dir, repoRoot)));
    if (run.runner === "claude" && result.findings.length === 0) {
      const asked = await callClaude(
        project.dir,
        PROBE_PROMPT,
        run.model,
        3,
        join(project.parent, "transcript-probe.jsonl"),
        5 * 60_000,
      );
      result.input += asked.input;
      result.output += asked.output;
      result.costUsd += asked.costUsd;
      result.findings.push(...replyFindings(asked.text, project.dir, repoRoot));
      result.findings.push(...audit(asked.transcript, project.dir, repoRoot));
    }
    if (result.findings.length > 0) {
      result.probe = "failed";
      return result;
    }
    const taskMd = await readFile(join(taskDir, "TASK.md"), "utf8");
    const maxIter = run.runner === "none" ? 1 : run.maxIter;
    let feedback = "";
    while (result.iterations < maxIter && !result.converged) {
      result.iterations++;
      if (run.runner === "claude") {
        const prompt = feedback === "" ? taskMd : `${taskMd}\n\nPrevious iteration output:\n${feedback}`;
        const file = join(project.parent, `transcript-${result.iterations}.jsonl`);
        const reply = await callClaude(project.dir, prompt, run.model, 80, file);
        result.input += reply.input;
        result.output += reply.output;
        result.costUsd += reply.costUsd;
        const bad = audit(reply.transcript, project.dir, repoRoot);
        if (bad.length > 0) {
          result.findings.push(...bad);
          result.audit = "failed";
          await copyFile(file, join(tmpdir(), `keel-audit-failed-${Date.now()}-${basename(file)}`));
          return result;
        }
      }
      const check = await sh("pnpm", ["check", "--quiet"], project.dir);
      const test = await sh("pnpm", ["test", "--quiet"], project.dir, {}, 600_000);
      result.checkExit = check.ok ? 0 : 1;
      result.testExit = test.ok ? 0 : 1;
      result.checkTrailer = lastLine(check.output);
      result.testTrailer = lastLine(test.output);
      await importApp(project.dir, target, task.scripts);
      // The workspace's `check` script includes biome; the public project has none, so the import formats with the root's.
      await sh(join(repoRoot, "node_modules", ".bin", "biome"), ["format", "--write", "modules", "test"], target);
      if (run.runner === "claude") {
        const installed = await sh("pnpm", ["install", "--prefer-offline"], repoRoot);
        if (!installed.ok) feedback = `root pnpm install failed:\n${installed.output}`;
      }
      const passed: unknown = await Promise.resolve(run.pass()).catch(() => false);
      result.converged = check.ok && test.ok && passed === true;
      if (!result.converged && run.runner === "claude") {
        const c = await sh("pnpm", ["check"], project.dir);
        const t = await sh("pnpm", ["test"], project.dir);
        feedback = `$ pnpm check\n${c.output}\n$ pnpm test\n${t.output}`;
      }
    }
    return result;
  } finally {
    // A run without an agent leaves the repository as it found it; a converged or failed agent run keeps the import.
    if (run.runner === "none" && (await exists(target))) await rm(target, { recursive: true, force: true });
    await rm(project.parent, { recursive: true, force: true });
    if (made) await rm(kit, { recursive: true, force: true });
  }
}
