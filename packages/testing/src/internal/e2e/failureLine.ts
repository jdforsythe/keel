/**
 * The line and column of a failure in `file` (the test file): the first frame of `stack` there, else `at` (the test's
 * own location).
 */
export function failureLine(
  stack: string,
  file: string,
  at: { readonly line: number; readonly column: number },
): { readonly line: number; readonly column: number } {
  for (const l of stack.split("\n")) {
    const i = l.indexOf(`${file}:`);
    if (i < 0) continue;
    const m = /^:(\d+):(\d+)/.exec(l.slice(i + file.length));
    if (m?.[1] !== undefined && m[2] !== undefined) return { line: Number(m[1]), column: Number(m[2]) };
  }
  return at;
}
