// Vitest 2 reporter implementing docs/OUTPUT.md: silent passes, failures as T0001 diagnostics, one trailer.
import path from "node:path";
import type { Reporter } from "vitest/reporters";
import type { Diag, Summary } from "./output.ts";
import { emit } from "./output.ts";

type Frame = { file: string; line: number; col: number };
type Err = { message?: string; diff?: string; stacks?: Frame[]; stack?: string };
type Node = {
  type?: string;
  name: string;
  mode?: string;
  tasks?: Node[];
  file?: { filepath?: string };
  result?: { state?: string; errors?: Err[] };
};

const isNode = (x: unknown): x is Node => typeof x === "object" && x !== null && "name" in x;
const errMessage = (e: unknown): string =>
  typeof e === "object" && e !== null && "message" in e ? String(e.message) : String(e);

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const strip = (s: string): string => s.replace(ANSI, "");
const rel = (p: string): string => path.relative(process.cwd(), p).split(path.sep).join("/");
const isApp = (f: string): boolean =>
  path.isAbsolute(f) &&
  !f.includes("node_modules") &&
  !f.startsWith("node:") &&
  !f.includes("/vitest/") &&
  !f.includes("/@vitest/");

function frames(e: Err): Frame[] {
  if (e.stacks?.length) return e.stacks.filter((f) => isApp(f.file));
  const out: Frame[] = [];
  for (const l of (e.stack ?? "").split("\n")) {
    const m = /\(?((?:\/|[A-Za-z]:)[^():]+):(\d+):(\d+)\)?$/.exec(l.trim());
    if (m?.[1] && m[2] && m[3] && isApp(m[1])) out.push({ file: m[1], line: Number(m[2]), col: Number(m[3]) });
  }
  return out;
}

/** Keep only changed lines of a vitest diff; never two dumps. */
function compactDiff(d: string | undefined): string | undefined {
  if (!d) return undefined;
  const lines = strip(d)
    .split("\n")
    .filter((l) => /^[-+] /.test(l) || /^[-+]$/.test(l));
  const changed = lines.filter((l) => !/^[-+] (Expected|Received)\b/.test(l));
  if (!changed.length) return undefined;
  const shown = changed.slice(0, 8);
  return shown.join("\n") + (changed.length > shown.length ? `\n... +${changed.length - shown.length} diff lines` : "");
}

function walk(
  n: Node,
  file: string,
  acc: { diags: Diag[]; tests: number; failed: number; skipped: number },
  trail: string[],
): void {
  const name = [...trail, n.name].filter(Boolean);
  if (n.type === "test" || n.type === "custom") {
    acc.tests++;
    const state = n.result?.state;
    if (state === "fail") {
      acc.failed++;
      const e = n.result?.errors?.[0] ?? {};
      const fs = frames(e).slice(0, 5);
      const top = fs[0];
      const msg = strip(e.message ?? "test failed").split("\n")[0] ?? "test failed";
      const label = `${name.join(" > ")}: ${msg}`;
      const diff = compactDiff(e.diff);
      const more = fs
        .slice(1)
        .map((f) => `at ${rel(f.file)}:${f.line}:${f.col}`)
        .join("\n");
      const fix = [diff, more].filter(Boolean).join("\n") || undefined;
      acc.diags.push({
        kind: "diag",
        code: "T0001",
        path: rel(top?.file ?? file),
        line: top?.line ?? 1,
        col: top?.col ?? 1,
        message: label.length > 90 ? `${label.slice(0, 87)}...` : label,
        ...(fix ? { fix } : {}),
      });
    } else if (state === "skip" || state === "todo" || n.mode === "skip" || n.mode === "todo") acc.skipped++;
  }
  for (const c of n.tasks ?? []) walk(c, file, acc, name);
}

export class KeelReporter implements Reporter {
  private t0 = performance.now();

  onFinished(files: unknown[] = [], errors: unknown[] = []): void {
    const diags: Diag[] = [];
    const acc = { diags, tests: 0, failed: 0, skipped: 0 };
    for (const f of files.filter(isNode)) {
      const fp = f.file?.filepath ?? f.name;
      for (const t of f.tasks ?? []) walk(t, fp, acc, []);
      if (f.result?.state === "fail" && !acc.diags.some((d) => d.path === rel(fp))) {
        const e = f.result.errors?.[0];
        acc.failed++;
        acc.diags.push({
          kind: "diag",
          code: "T0001",
          path: rel(fp),
          line: 1,
          col: 1,
          message: strip(e?.message ?? "file failed to run").split("\n")[0] ?? "file failed",
        });
      }
    }
    for (const e of errors)
      acc.diags.push({
        kind: "diag",
        code: "T0001",
        message: strip(errMessage(e)).split("\n")[0] ?? "unhandled error",
      });
    const bad = acc.failed > 0 || errors.length > 0;
    const summary: Summary = {
      kind: "summary",
      ok: !bad,
      counts: { tests: acc.tests, failed: acc.failed, skipped: acc.skipped },
      ms: performance.now() - this.t0,
    };
    const text = emit([...acc.diags, summary]);
    if (text) process.stdout.write(`${text}\n`);
    if (bad) process.exitCode = 1;
  }
}
