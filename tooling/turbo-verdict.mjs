// The verdict of one `turbo run`, from its exit status and its output. A run is ok only when turbo exited 0 and every
// task it scheduled succeeded. A failing run names each failed task and counts each task that never finished (one
// turbo cancelled, or one a signal ended), so one failure in the output never stands for the whole run.

/**
 * @param {number | null} status the turbo process's exit status, null when a signal ended it
 * @param {string} output its stdout and stderr
 * @returns {{ ok: boolean, successful: number, total: number, failed: string[], unfinished: number }}
 */
export function turboVerdict(status, output) {
  const tasks = /Tasks:\s+(\d+) successful, (\d+) total/.exec(output);
  const successful = Number(tasks?.[1] ?? 0);
  const total = Number(tasks?.[2] ?? 0);
  const failed = (/^\s*Failed:\s+(.+)$/m.exec(output)?.[1] ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const unfinished = Math.max(0, total - successful - failed.length);
  return { ok: status === 0 && successful === total, successful, total, failed, unfinished };
}

const DIAG = /^[A-Z]\d{4} /;
/** A line of a task's log that states an error: Node's `Error: ...`, a fatal error, vitest's startup or unhandled error. */
const ERROR_LINE = /\b\w*Error\b|FATAL|Startup Error|failed to load|Unhandled/;
const CONT = /^ {2}(fix|see): |^ {7}\S/;

/**
 * A task's own log lines in turbo's output: each line with its `<pkg>:<task>: ` prefix, and each line of its
 * `::group::<pkg>:<task>` block, the form turbo writes under GitHub Actions when no `--log-prefix` is given.
 * @param {string} output
 * @param {string} prefix `@keel/cli:test: `
 */
function ownLines(output, prefix) {
  const group = `::group::${prefix.trimEnd().slice(0, -1)}`;
  const own = [];
  let inGroup = false;
  for (const l of output.split("\n")) {
    if (inGroup && l.startsWith("::endgroup::")) inGroup = false;
    else if (inGroup) own.push(l);
    else if (l.trimEnd() === group) inGroup = true;
    else if (l.startsWith(prefix)) own.push(l.slice(prefix.length));
  }
  return own;
}

/**
 * What each failed task said, from turbo's prefixed log (`@keel/cli:test: T0001 ...`): its diagnostic lines (each
 * with the `fix:` lines under it), the paths made relative to the repository with `dirs` (package name to its
 * directory), its `fail ...` trailer, the exit status turbo reports, and, for a task that printed no diagnostic, the
 * last lines it wrote.
 * @param {string[]} failed task ids, `@keel/cli#test`
 * @param {string} output turbo's stdout and stderr
 * @param {Record<string, string>} dirs
 * @returns {{ task: string, diags: string[], lines: string[], trailer: string | undefined, exit: number | undefined, tail: string[] }[]}
 */
export function taskFailures(failed, output, dirs) {
  return failed.map((task) => {
    const hash = task.lastIndexOf("#");
    const pkg = task.slice(0, hash);
    const prefix = `${pkg}:${task.slice(hash + 1)}: `;
    const dir = dirs[pkg];
    const own = ownLines(output, prefix);
    const exit = output
      .split("\n")
      .filter((l) => l.startsWith(`${task}: `))
      .map((l) => /exited \((\d+)\)/.exec(l)?.[1])
      .find((x) => x !== undefined);
    /** `conformance/x.test.ts:4:2 ...` as `packages/cli/conformance/x.test.ts:4:2 ...` */
    const rooted = (l) =>
      dir === undefined || dir === "." ? l : l.replace(/^([A-Z]\d{4}) (?!\.\.\/)([^\s:]+\.\w+:\d+)/, `$1 ${dir}/$2`);
    const diags = [];
    const lines = [];
    let inDiag = false;
    for (const l of own) {
      if (DIAG.test(l)) {
        const r = rooted(l);
        diags.push(r);
        lines.push(r);
        inDiag = true;
      } else if (inDiag && CONT.test(l)) lines.push(l);
      else inDiag = false;
    }
    const trailer = own.filter((l) => /^fail \d+ tests/.test(l)).at(-1);
    const tail = own
      .map((l) => l.trimEnd())
      .filter((l) => l !== "" && !/ELIFECYCLE|^\$ /.test(l))
      .slice(-12);
    return { task, diags, lines, trailer, exit: exit === undefined ? undefined : Number(exit), tail };
  });
}

/**
 * The E0005 message of a failed run that names, per failed task, where each failed test is
 * (`turbo test failed: @keel/cli#test packages/cli/test/a.test.ts:4; 3 of 60 tasks unfinished`); a task that named
 * no test says how it ended and the last error line it wrote, else its last line
 * (`@keel/std-postgres#test exit 137: Error: listen EADDRINUSE 127.0.0.1:5432`), or `no test named` when it wrote none.
 * @param {string} task
 * @param {ReturnType<typeof turboVerdict>} v
 * @param {ReturnType<typeof taskFailures>} failures
 */
export function failVerdict(task, v, failures) {
  const per = failures.map((f) => {
    const at = [...new Set(f.diags.map((d) => /^[A-Z]\d{4} (\S+?:\d+)(?::\d+)? /.exec(d)?.[1] ?? d.slice(6, 40)))];
    if (at.length > 0) return `${f.task} ${at.join(", ")}`;
    const said = [...f.tail].reverse().find((l) => ERROR_LINE.test(l)) ?? f.tail.at(-1);
    const how = `${f.task} exit ${f.exit ?? "?"}`;
    return said === undefined
      ? `${how}, no test named`
      : `${how}: ${said.length > 100 ? `${said.slice(0, 97)}...` : said}`;
  });
  const what = [...per];
  if (v.unfinished > 0) what.push(`${v.unfinished} of ${v.total} tasks unfinished`);
  if (v.total === 0) what.push("no task summary");
  return `turbo ${task} failed${what.length > 0 ? `: ${what.join("; ")}` : ""}`;
}
