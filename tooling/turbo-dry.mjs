// The JSON document of `turbo run <task> --dry=json` from its stdout. `pnpm exec` may install before it runs turbo
// (pnpm's dependency check, as on the first run after build output is removed), and that install prints its lines
// (`Scope: all 62 workspace projects`, the lockfile policy, `Already up to date`) on the same stdout before turbo's
// document. turbo prints the document pretty, from a line that is `{` alone to a line that is `}` alone.

/**
 * @param {string} stdout the dry run's stdout
 * @returns {unknown} the parsed document
 */
export function dryRunJson(stdout) {
  const lines = stdout.split("\n");
  const start = lines.findIndex((l) => l.trimEnd() === "{");
  const end = lines.findLastIndex((l) => l.trimEnd() === "}");
  if (start < 0 || end < start) {
    const first = lines.find((l) => l.trim() !== "") ?? "";
    throw new Error(`turbo --dry=json printed no JSON document; its first line: ${first.slice(0, 120)}`);
  }
  return JSON.parse(lines.slice(start, end + 1).join("\n"));
}
