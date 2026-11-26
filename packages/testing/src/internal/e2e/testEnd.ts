import { mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import type { Problem } from "../../types/Problem.ts";
import { currentTask } from "../currentTask.ts";
import type { EndOfTest } from "./EndOfTest.ts";
import type { ServeRun } from "./ServeRun.ts";
import { e2eError } from "./e2eError.ts";
import { failureLine } from "./failureLine.ts";
import { fileEnds } from "./fileEnds.ts";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const SERVER_LINES = 10;

const ends = new WeakMap<object, EndOfTest>();
const loose: EndOfTest = {
  disposeAtEnd: (d) => fileEnds().push(d),
  serveAtEnd: (r) => fileEnds().push(r.dispose),
};

const problemText = (p: Problem): string => `${p.kind} ${p.text.split("\n")[0] ?? ""}`;

/**
 * The end of the vitest test running now (k.e2e Isolation, k.e2e-page Problems and Failure output), registered on the
 * task's `onFinished` once. When the test ends: a browser problem no `problems()` took fails it with E1738 naming the
 * first; a failed test writes a screenshot per tab and a trace per context under `reports/e2e/`, named
 * `<file>-<line>-<n>` after the test file and the failure's line, and its first error carries the lines its T0001
 * prints below it (`server:`, `screenshot:`, `trace:`); then every handle is disposed, passed or failed. Outside a test
 * (a hook, module scope) the handles are disposed when the file ends.
 */
export function testEnd(): EndOfTest {
  const task = currentTask();
  if (task === undefined || !("type" in task) || task.type !== "test") return loose;
  const had = ends.get(task);
  if (had !== undefined) return had;
  const disposals: (() => Promise<void>)[] = [];
  const serves: ServeRun[] = [];
  const end: EndOfTest = { disposeAtEnd: (d) => disposals.push(d), serveAtEnd: (r) => serves.push(r) };
  ends.set(task, end);
  const finished = async (): Promise<void> => {
    const unread = serves.flatMap((s) => s.unread());
    const result = "result" in task && isRec(task.result) ? task.result : undefined;
    const errors: unknown[] = Array.isArray(result?.errors) ? result.errors : [];
    const file = "file" in task && isRec(task.file) && typeof task.file.filepath === "string" ? task.file.filepath : "";
    const loc = "location" in task && isRec(task.location) ? task.location : {};
    const at = {
      line: typeof loc.line === "number" ? loc.line : 1,
      column: typeof loc.column === "number" ? loc.column : 1,
    };
    const first = unread[0];
    const e1738 =
      result?.state !== "fail" && first !== undefined
        ? e2eError("E1738", `${problemText(first)}; read it with problems()`, { problems: unread }, "k.e2e-page")
        : undefined;
    // E1738 has no frame of its own: it is the test's, at the test's line.
    if (e1738 !== undefined) e1738.stack = `${e1738.message}\n    at ${file}:${at.line}:${at.column}`;
    try {
      const failed = result?.state === "fail" || e1738 !== undefined;
      if (failed && serves.length > 0) {
        const head = errors[0];
        const stack = e1738?.stack ?? (isRec(head) && typeof head.stack === "string" ? head.stack : "");
        const { line } = failureLine(stack, file, at);
        const dir = join(process.cwd(), "reports", "e2e");
        mkdirSync(dir, { recursive: true });
        const base = `${basename(file).replace(/\.[cm]?[jt]sx?$/, "")}-${line}`;
        const detail = serves
          .flatMap((s) => s.failureRecords())
          .slice(0, SERVER_LINES)
          .map((r) => `server: ${r}`);
        let n = 0;
        for (const tab of serves.flatMap((s) => s.tabs())) {
          const name = `${base}-${++n}.png`;
          const ok = await tab.screenshot({ path: join(dir, name), fullPage: true }).then(
            () => true,
            () => false,
          );
          if (ok) detail.push(`screenshot: reports/e2e/${name}`);
        }
        n = 0;
        for (const context of serves.flatMap((s) => s.contexts())) {
          const name = `${base}-${++n}.zip`;
          const ok = await context.tracing.stop({ path: join(dir, name) }).then(
            () => true,
            () => false,
          );
          if (ok) detail.push(`trace: reports/e2e/${name}`);
        }
        if (e1738 !== undefined) Object.assign(e1738, { keelDetail: detail });
        else if (isRec(head)) head.keelDetail = detail;
      }
    } finally {
      for (const s of serves.splice(0)) await s.dispose().catch(() => undefined);
      for (const d of disposals.splice(0)) await d().catch(() => undefined);
    }
    if (e1738 !== undefined) throw e1738;
  };
  const list = "onFinished" in task ? task.onFinished : undefined;
  if (Array.isArray(list)) list.push(finished);
  else Reflect.set(task, "onFinished", [finished]);
  return end;
}
