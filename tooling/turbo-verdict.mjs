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

/**
 * The E0005 message of a failed run: `turbo test failed: @keel/cli#test; 3 of 60 tasks unfinished`.
 * @param {string} task
 * @param {ReturnType<typeof turboVerdict>} v
 */
export function failMessage(task, v) {
  const what = [];
  if (v.failed.length > 0) what.push(v.failed.join(", "));
  if (v.unfinished > 0) what.push(`${v.unfinished} of ${v.total} tasks unfinished`);
  if (v.total === 0) what.push("no task summary");
  return `turbo ${task} failed${what.length > 0 ? `: ${what.join("; ")}` : ""}`;
}
