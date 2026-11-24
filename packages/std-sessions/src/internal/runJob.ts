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

/** The test run's own diagnostics, or E1052 when it reported none: the job test never ran. */
function withNotRun(op: string, diags: OutRecord[]): OutRecord[] {
  if (diags.length > 0) return diags;
  return [
    {
      kind: "diag",
      code: "E1052",
      message: `session ${op}: the job test did not run; add ".keel/sessions/*.test.ts" to vitest include`,
      fix: '-  include: ["test/**/*.test.{ts,tsx}"]\n+  include: ["test/**/*.test.{ts,tsx}", ".keel/sessions/*.test.ts"]',
      see: "k.cli",
    },
  ];
}

/**
 * Run one `keel session` job inside the project's `keel test` runner (std.sessions D1): write
 * `.keel/sessions/job-<pid>-<n>.test.ts`, which imports each route table of `routes` and calls
 * `commandJob` from `@keel/std-sessions/commandJob` with the session inline (with `serve`, also `serve(ctx)`, which
 * builds the app as the generated entry does: `createApp` over `topology.ts`, the tables and `identity.server.ts`;
 * with `mount`, `identity.ts`'s default export as `mount`, as the built entry passes it); run `keel test <job> --format=json` on
 * `io.cwd` (the project's vitest config and environment, `KEEL_TEST=1`); read `JobResult` back from the
 * `.result.json` beside it; remove both. Without a result, the test run's diagnostics come back instead (app code threw on import); a run that
 * reported none means the project's vitest `include` misses `.keel/sessions/`, and E1052 says so.
 */
export async function runJob(
  io: Io,
  job: {
    readonly op: "replay" | "minimize" | "to-test";
    readonly session: unknown;
    readonly modules: readonly string[];
    /**
     * With a `node` deployable serving the route: its name, whether the project has an `identity.server.ts`, and the
     * import specifiers (from the job file, `.keel/sessions/`) of every placed module's route table, which the job
     * replays over in place of `modules`.
     */
    readonly serve?: { readonly deployable: string; readonly identity: boolean; readonly routes: readonly string[] };
    readonly user?: string;
    /** Without `serve`, whether the project has `identity.ts`: the job passes its default export as `mount`. */
    readonly mount?: boolean;
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
  const specs = job.serve?.routes ?? job.modules.map((m) => `../../modules/${m}/routes.ts`);
  const imports = specs.map((from, i) => `import { routes as r${i} } from ${JSON.stringify(from)};`);
  const { serve } = job;
  if (serve !== undefined)
    imports.push(
      'import { routeTable } from "@keel/router";',
      'import { createApp } from "@keel/server";',
      'import topology from "../../topology.ts";',
      ...(serve.identity ? ['import identity from "../../identity.server.ts";'] : []),
    );
  const mount = serve === undefined && job.mount === true;
  if (mount) imports.push('import mount from "../../identity.ts";');
  const tables = specs.map((_, i) => `r${i}`).join(", ");
  const serveOption =
    serve === undefined
      ? ""
      : `, serve: (ctx) => createApp({ topology, deployable: ${JSON.stringify(serve.deployable)}, routes: routeTable(${tables}), ctx${serve.identity ? ", identity" : ""} })`;
  const args = {
    op: job.op,
    result: resultFile,
    expose: job.expose,
    redact: job.redact,
    ...(job.user === undefined ? {} : { user: job.user }),
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
    `  await commandJob({ ...${JSON.stringify(args)}, session, routes: [${tables}]${serveOption}${mount ? ", mount" : ""} });`,
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
    if (!existsSync(resultFile)) return { ok: false, diags: withNotRun(job.op, diagsOf(r.stdout)) };
    const parsed = JobResult.parse(JSON.parse(readFileSync(resultFile, "utf8")));
    return parsed.ok ? { ok: true, result: parsed.value } : { ok: false, diags: withNotRun(job.op, diagsOf(r.stdout)) };
  } finally {
    rmSync(testFile, { force: true });
    rmSync(resultFile, { force: true });
  }
}
