import type { TestDiag } from "./types/TestDiag.ts";
import type { TestReport } from "./types/TestReport.ts";

type Rec = Readonly<Record<string, unknown>>;
type Frame = { readonly file: string; readonly line: number; readonly col: number };

const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const ESC = String.fromCharCode(27);
const ANSI = new RegExp(`${ESC}\\[[0-9;]*m`, "g");
const strip = (s: string): string => s.replace(ANSI, "");
const firstLine = (s: string): string => strip(s).split("\n")[0] ?? "";
/** A T0001 message by the k.check rule: one line, at most 89 UTF-16 code units, a cut keeping 86 (85 before a pair's first half) and `...`. */
const clip = (s: string): string => {
  const one = s.replace(/\s*\n\s*/g, " ").trim();
  if (one.length <= 89) return one;
  const last = one.charCodeAt(85);
  return `${one.slice(0, last >= 0xd800 && last <= 0xdbff ? 85 : 86)}...`;
};
const FRAME = /(?:^|[\s(])(?:file:\/\/)?((?:\/|[A-Za-z]:[\\/])[^():]+):(\d+):(\d+)\)?$/;

const isApp = (f: string): boolean =>
  (f.startsWith("/") || /^[A-Za-z]:[\\/]/.test(f)) &&
  !f.includes("node_modules") &&
  !f.startsWith("node:") &&
  !f.includes("/vitest/") &&
  !f.includes("/@vitest/");

/** `p` relative to `cwd` with `/` separators (`../` when outside). */
function relative(cwd: string, p: string): string {
  const from = cwd.split(/[\\/]/).filter((s) => s !== "");
  const to = p.split(/[\\/]/).filter((s) => s !== "");
  if (!(p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p))) return to.join("/");
  let i = 0;
  while (i < from.length && i < to.length && from[i] === to[i]) i++;
  return [...from.slice(i).map(() => ".."), ...to.slice(i)].join("/");
}

/** App frames of a vitest error: its parsed `stacks` when present, else its `stack` text. */
function frames(e: Rec): Frame[] {
  const parsed = Array.isArray(e.stacks) ? e.stacks : [];
  const fromStacks = parsed.flatMap((f): Frame[] => {
    const file = isRec(f) ? str(f.file) : undefined;
    if (!isRec(f) || file === undefined || !isApp(file)) return [];
    const col = typeof f.column === "number" ? f.column : typeof f.col === "number" ? f.col : 1;
    return [{ file, line: typeof f.line === "number" ? f.line : 1, col }];
  });
  if (fromStacks.length > 0) return fromStacks;
  return (str(e.stack) ?? "").split("\n").flatMap((l): Frame[] => {
    const m = FRAME.exec(l.trim());
    const file = m?.[1];
    return file !== undefined && isApp(file) ? [{ file, line: Number(m?.[2]), col: Number(m?.[3]) }] : [];
  });
}

/**
 * One T0001 for an error outside any test's result: `uncaught: <code> <first line>`, at its first app frame, else at
 * 1:1 of the file vitest names for it (`VITEST_TEST_PATH`), else unlocated.
 */
function uncaught(e: unknown, cwd: string): TestDiag {
  const rec = isRec(e) ? e : {};
  const code = str(rec.code);
  const said = firstLine(isRec(e) ? (str(e.message) ?? "unhandled error") : String(e)).trim();
  const message = clip(
    `uncaught: ${code === undefined ? "" : `${code} `}${said === "" ? "error outside any test" : said}`,
  );
  const [top] = frames(rec);
  const file = str(rec.VITEST_TEST_PATH);
  if (top !== undefined)
    return { kind: "diag", code: "T0001", path: relative(cwd, top.file), line: top.line, col: top.col, message };
  if (file !== undefined && file !== "")
    return { kind: "diag", code: "T0001", path: relative(cwd, file), line: 1, col: 1, message };
  return { kind: "diag", code: "T0001", message };
}

/** Changed lines of a vitest diff only (never two dumps), at most 8. */
function compactDiff(d: string | undefined): string | undefined {
  if (d === undefined || d === "") return undefined;
  const changed = strip(d)
    .split("\n")
    .filter((l) => /^[-+] /.test(l) || /^[-+]$/.test(l))
    .filter((l) => !/^[-+] (Expected|Received)\b/.test(l));
  if (changed.length === 0) return undefined;
  const shown = changed.slice(0, 8);
  return shown.join("\n") + (changed.length > shown.length ? `\n... +${changed.length - shown.length} diff lines` : "");
}

/**
 * Turn vitest's finished task tree (`state.getFiles()` and the unhandled errors of `onTestRunEnd`) into OUTPUT.md terms: one T0001 per failed
 * test at its first app frame (`path:line:col` relative to `cwd`), the message `suite > test: first line`, and
 * a harness failure carrying an E17xx `code` (E1704 `properties` and `simulate`, E1708-E1710 `explore`) as that code
 * at the test file's own frame, the message `first line (suite > test)`; each with
 * a `fix` carrying the compact diff and up to four more app frames; a file that failed outside any test gets
 * one T0001 at line 1; each error outside any test's result (vitest's unhandled errors, or one `keel test` held
 * around the run) one T0001 `uncaught: <code> <first line>` at its first app frame, else at 1:1 of its
 * `VITEST_TEST_PATH`, else unlocated. Pure; shared by the cli and the repository's vitest reporter.
 */
export function testResults(files: readonly unknown[], errors: readonly unknown[], cwd: string): TestReport {
  const diagnostics: TestDiag[] = [];
  let tests = 0;
  let failed = 0;
  let skipped = 0;
  const walk = (node: unknown, file: string, trail: readonly string[]): void => {
    if (!isRec(node)) return;
    const name = [...trail, str(node.name) ?? ""].filter((n) => n !== "");
    const result = isRec(node.result) ? node.result : {};
    if (node.type === "test" || node.type === "custom") {
      tests++;
      const state = str(result.state);
      if (state === "fail") {
        failed++;
        const first: unknown = Array.isArray(result.errors) ? result.errors[0] : undefined;
        const e = isRec(first) ? first : {};
        // A harness failure (E1702-E1710) keeps its code; it is located at the test's own frame when it has one.
        const raw = str(e.code) ?? "";
        const coded: `E17${string}` | undefined = /^E17\d\d$/.test(raw) ? `E17${raw.slice(3)}` : undefined;
        const all = frames(e);
        const own = coded === undefined ? -1 : all.findIndex((f) => f.file === file);
        const fs = (own > 0 ? [...all.slice(own, own + 1), ...all.slice(0, own), ...all.slice(own + 1)] : all).slice(
          0,
          5,
        );
        const top = fs[0];
        const more = fs.slice(1).map((f) => `at ${relative(cwd, f.file)}:${f.line}:${f.col}`);
        const fix = [compactDiff(str(e.diff)), ...more].filter((x): x is string => x !== undefined).join("\n");
        const said = firstLine(str(e.message) ?? "test failed");
        diagnostics.push({
          kind: "diag",
          code: coded ?? "T0001",
          path: relative(cwd, top?.file ?? file),
          line: top?.line ?? 1,
          col: top?.col ?? 1,
          message: clip(
            coded === undefined
              ? `${name.join(" > ")}: ${said}`
              : `${said.replace(/^E17\d\d\s+/, "")} (${name.join(" > ")})`,
          ),
          ...(fix === "" ? {} : { fix }),
        });
      } else if (state === "skip" || state === "todo" || node.mode === "skip" || node.mode === "todo") skipped++;
    }
    for (const t of Array.isArray(node.tasks) ? node.tasks : []) walk(t, file, name);
  };
  for (const f of files) {
    if (!isRec(f)) continue;
    const path = (isRec(f.file) ? str(f.file.filepath) : undefined) ?? str(f.filepath) ?? str(f.name) ?? "";
    const before = failed;
    for (const t of Array.isArray(f.tasks) ? f.tasks : []) walk(t, path, []);
    const result = isRec(f.result) ? f.result : {};
    if (result.state === "fail" && failed === before) {
      failed++;
      const first: unknown = Array.isArray(result.errors) ? result.errors[0] : undefined;
      const message = firstLine((isRec(first) ? str(first.message) : undefined) ?? "file failed to run");
      const at = relative(cwd, path);
      diagnostics.push({ kind: "diag", code: "T0001", path: at, line: 1, col: 1, message: clip(message) });
    }
  }
  for (const e of errors) diagnostics.push(uncaught(e, cwd));
  return { diagnostics, tests, failed, skipped, errors: errors.length };
}
