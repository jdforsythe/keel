// Vitest reporter implementing docs/OUTPUT.md: silent passes, failures as T0001 diagnostics, one trailer.
// The task-tree walk (frames, compact diff, messages) is `testResults` from @keel/testing: one implementation,
// shared with `keel test`. Imported by path: tooling is private and @keel/testing depends on it.
// A fork worker that dies mid-run is one T0001 per test file it was running, at that file, naming the test it was
// in and what ended it (worker-exits.ts): `T0001 test/a.test.ts:1:1 orders > saves: worker killed by SIGKILL`.
import path from "node:path";
import type { TestCase, TestModule, Vitest } from "vitest/node";
import type { Reporter } from "vitest/reporters";
import { testResults } from "../packages/testing/src/testResults.ts";
import type { Diag, Summary } from "./output.ts";
import { emit } from "./output.ts";
import { type WorkerExit, describeExit, watchWorkerExits, workerExits } from "./worker-exits.ts";

const CRASH = /^\[vitest-pool\]: Worker \w+ emitted error\.|Worker exited unexpectedly/;

const messageOf = (e: unknown): string =>
  typeof e === "object" && e !== null && "message" in e && typeof e.message === "string" ? e.message : String(e);

/** True for vitest's error for a worker that died mid-run. */
export const isCrash = (e: unknown): boolean => CRASH.test(messageOf(e));

/** A test file a worker was running when it died, and the test it was in (none while collecting). */
export type Unfinished = { readonly file: string; readonly test: string | undefined };

const clip = (s: string): string => (s.length > 90 ? `${s.slice(0, 87)}...` : s);

/**
 * The T0001 lines of `crashes` worker deaths. Each recorded exit is one line per unfinished file vitest had sent that
 * worker, at the file, with the test running in it; an unfinished file no exit claims gets a line of its own, and
 * a death with neither an exit nor an unfinished file one line without location. A worker whose last word is a
 * diagnostic of its own (the watchdog's `T0001 ... watchdog killed ...`) has said it: it gets no second line.
 */
export function crashDiags(
  crashes: number,
  unfinished: readonly Unfinished[],
  exits: readonly WorkerExit[],
  cwd: string,
): Diag[] {
  if (crashes === 0) return [];
  const rel = (f: string): string => path.relative(cwd, f).split(path.sep).join("/");
  const at = (u: Unfinished, e: WorkerExit | undefined): Diag => ({
    kind: "diag",
    code: "T0001",
    path: rel(u.file),
    line: 1,
    col: 1,
    message: clip(`${u.test ?? "collecting the file"}: ${describeExit(e)}`),
  });
  const claimed = new Set<string>();
  const out: Diag[] = [];
  for (const e of exits) {
    if (/^[A-Z]\d{4} /.test(e.said)) {
      for (const u of unfinished) if (e.files.includes(u.file)) claimed.add(u.file);
      continue;
    }
    const mine = unfinished.filter((u) => e.files.includes(u.file));
    for (const u of mine) claimed.add(u.file);
    if (mine.length > 0) out.push(...mine.map((u) => at(u, e)));
    else out.push({ kind: "diag", code: "T0001", message: clip(`${e.files.map(rel).join(", ")}: ${describeExit(e)}`) });
  }
  out.push(...unfinished.filter((u) => !claimed.has(u.file)).map((u) => at(u, undefined)));
  for (let i = out.length + exits.filter((e) => /^[A-Z]\d{4} /.test(e.said)).length; i < crashes; i++)
    out.push({ kind: "diag", code: "T0001", message: describeExit(undefined) });
  return out;
}

/**
 * The T0001 lines vitest's own verdict adds. A run ended as `interrupted` names each file it left unfinished, at the
 * file, with the test it was in. A run ended as `failed` or `interrupted` with no failure of its own (`failing` false)
 * and no unfinished file is one line without location: `no test ran` when it ran none. `passed`: nothing.
 */
export function endDiags(
  reason: string,
  failing: boolean,
  unfinished: readonly Unfinished[],
  tests: number,
  cwd: string,
): Diag[] {
  if (reason === "passed") return [];
  const why = `vitest ended the run as ${reason}`;
  if (reason === "interrupted" && unfinished.length > 0)
    return unfinished.map((u) => ({
      kind: "diag",
      code: "T0001",
      path: path.relative(cwd, u.file).split(path.sep).join("/"),
      line: 1,
      col: 1,
      message: clip(`${u.test ?? "collecting the file"}: ${why}`),
    }));
  if (failing) return [];
  return [{ kind: "diag", code: "T0001", message: `${tests === 0 ? "no test ran" : "no test failed"}: ${why}` }];
}

/**
 * The first test of `m` with no result: the one its worker was in when it died, when the worker died before vitest
 * heard that test start.
 */
function firstUnfinished(m: TestModule | undefined): string | undefined {
  for (const t of m?.children.allTests() ?? []) if (t.result().state === "pending") return t.fullName;
  return undefined;
}

export class KeelReporter implements Reporter {
  private t0 = performance.now();
  private run: Vitest | undefined;
  /** Files started and not ended, each with the test running in it. */
  private readonly open = new Map<string, string | undefined>();

  onInit(vitest: Vitest): void {
    this.run = vitest;
    watchWorkerExits();
  }

  onTestModuleStart(m: TestModule): void {
    this.open.set(m.moduleId, undefined);
  }

  onTestModuleEnd(m: TestModule): void {
    this.open.delete(m.moduleId);
  }

  onTestCaseReady(t: TestCase): void {
    this.open.set(t.module.moduleId, t.fullName);
  }

  onTestCaseResult(t: TestCase): void {
    if (this.open.has(t.module.moduleId)) this.open.set(t.module.moduleId, undefined);
  }

  onTestRunEnd(_modules: readonly unknown[], errors: readonly unknown[], reason = "passed"): void {
    // Without the instance there is no task tree to read: report that as an error, never as an empty green run.
    const started = this.run !== undefined;
    const crashes = errors.filter(isCrash).length;
    const r = testResults(
      this.run?.state.getFiles() ?? [],
      started ? errors.filter((e) => !isCrash(e)) : [new Error("vitest ended the run without starting it")],
      process.cwd(),
    );
    const modules = this.run?.state.getTestModules() ?? [];
    const unfinished = [...this.open].map(([file, test]) => ({
      file,
      test: test ?? firstUnfinished(modules.find((m) => m.moduleId === file)),
    }));
    const crashed = crashDiags(crashes, unfinished, workerExits(), process.cwd());
    // Each file a dead worker left unfinished had a test (or its collection) failed by that death.
    const failedSoFar = r.failed + (crashes > 0 ? Math.max(unfinished.length, crashed.length) : 0);
    // Vitest's own verdict counts too: a run it ended as failed or interrupted with no failure above is named here.
    // A crash already named the files its worker left unfinished.
    const left = crashes > 0 ? [] : unfinished;
    const ended = endDiags(reason, failedSoFar > 0 || r.errors > 0 || crashes > 0, left, r.tests, process.cwd());
    const diags: Diag[] = [...r.diagnostics.map((d) => ({ ...d })), ...crashed, ...ended];
    const failed = failedSoFar + ended.filter((d) => d.path !== undefined).length;
    const bad = failed > 0 || r.errors > 0 || crashes > 0 || ended.length > 0;
    const summary: Summary = {
      kind: "summary",
      ok: !bad,
      counts: { tests: r.tests, failed, skipped: r.skipped },
      ms: performance.now() - this.t0,
    };
    const text = emit([...diags, summary]);
    if (text) process.stdout.write(`${text}\n`);
    if (bad) process.exitCode = 1;
  }
}
