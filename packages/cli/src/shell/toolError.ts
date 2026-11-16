const ERROR = /(?:^\W*|: )(?:error|failure)\b/i;

/**
 * What `keel build` shows of a failed tool's output (docs/OUTPUT.md): its lines from the first error line (`error`
 * or `FAILURE` first on a line or after `: `), at most 12, then a count of the rest; with no error line, its last
 * five. Blank lines and ANSI colors are dropped, and paths under `root` are relative to it.
 */
export function toolError(output: string, root: string): string {
  const lines = output
    // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI color sequences start with the escape character
    .replace(/\x1b\[[\d;]*m/g, "")
    .replaceAll(`${root}/`, "")
    .trimEnd()
    .split(/\s*\n/)
    .filter((l) => l !== "");
  const at = lines.findIndex((l) => ERROR.test(l));
  if (at < 0) return `${lines.slice(-5).join("\n")}\n`;
  const rest = lines.length - at - 12;
  return `${lines.slice(at, at + 12).join("\n")}\n${rest > 0 ? `... +${rest} more lines\n` : ""}`;
}
