import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Io, type OutRecord, run } from "@keel/cli";
import { JobResult } from "./JobResult.ts";

let jobs = 0;

/** The `diag` records of a `keel test --format=json` run's stdout. */
function diagsOf(stdout: string): OutRecord[] {
  const out: OutRecord[] = [];
  for (const line of stdout.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const v: unknown = JSON.parse(line);
      if (typeof v === "object" && v !== null && "kind" in v && v.kind === "diag" && "code" in v) {
        const rec: Record<string, unknown> = {};
        for (const [k, x] of Object.entries(v)) rec[k] = x;
        out.push({ ...rec, kind: "diag" });
      }
    } catch {
      // not a record
    }
  }
  return out;
}

/**
 * Run one `keel session` job inside the project's `keel test` runner (std.sessions D1): write
 * `.keel/sessions/job-<pid>-<n>.test.ts`, which imports each serving module's `routes.ts` and calls
 * `commandJob` from `@keel/std-sessions/commandJob` with the session inline; run `keel test <job> --format=json` on
 * `io.cwd` (the project's vitest config and environment, `KEEL_TEST=1`); read `JobResult` back from the
 * `.result.json` beside it; remove both. Without a result (the project's vitest `include` misses `.keel/sessions/`,
 * or app code throws on import), the test run's diagnostics come back instead.
 */
export async function runJob(
  io: Io,
  job: {
    readonly op: "replay" | "minimize" | "to-test";
    readonly session: unknown;
    readonly modules: readonly string[];
    readonly maxRuns?: number;
    readonly expose: readonly string[];
    readonly redact: readonly string[];
  },
): Promise<{ readonly ok: true; readonly result: JobResult } | { readonly ok: false; readonly diags: OutRecord[] }> {
  const dir = path.join(io.cwd, ".keel", "sessions");
  mkdirSync(dir, { recursive: true });
  const name = `job-${process.pid}-${jobs++}`;
  const rel = `.keel/sessions/${name}.test.ts`;
  const testFile = path.join(dir, `${name}.test.ts`);
  const resultFile = path.join(dir, `${name}.result.json`);
  const imports = job.modules.map((m, i) => `import { routes as r${i} } from "../../modules/${m}/routes.ts";`);
  const args = {
    op: job.op,
    result: resultFile,
    expose: job.expose,
    redact: job.redact,
    ...(job.maxRuns === undefined ? {} : { maxRuns: job.maxRuns }),
  };
  const source = [
    "// keel session job (@keel/std-sessions/tools): generated, run once by keel test, then removed.",
    'import { commandJob } from "@keel/std-sessions/commandJob";',
    'import { test } from "vitest";',
    ...imports,
    "",
    `const session: unknown = ${JSON.stringify(job.session)};`,
    "",
    'test("keel session job", async () => {',
    `  await commandJob({ ...${JSON.stringify(args)}, session, routes: [${job.modules.map((_, i) => `r${i}`).join(", ")}] });`,
    "}, 600_000);",
    "",
  ].join("\n");
  writeFileSync(testFile, source);
  try {
    const r = await run(["test", rel, "--format=json"], {
      cwd: io.cwd,
      files: [{ path: rel, source }],
      tty: false,
      ...(io.env === undefined ? {} : { env: io.env }),
    });
    if (!existsSync(resultFile)) return { ok: false, diags: diagsOf(r.stdout) };
    const parsed = JobResult.parse(JSON.parse(readFileSync(resultFile, "utf8")));
    return parsed.ok ? { ok: true, result: parsed.value } : { ok: false, diags: diagsOf(r.stdout) };
  } finally {
    rmSync(testFile, { force: true });
    rmSync(resultFile, { force: true });
  }
}
