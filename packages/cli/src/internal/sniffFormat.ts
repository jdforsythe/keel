import type { Mode } from "../types/Mode.ts";

const MODES: readonly string[] = ["compact", "json", "pretty"];
const isMode = (v: string | undefined): v is Mode => v !== undefined && MODES.includes(v);

/** The `--format` value in argv when it is valid, so usage errors still render in the requested mode. */
export function sniffFormat(argv: readonly string[]): Mode | undefined {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue;
    if (a.startsWith("--format=")) {
      const v = a.slice(9);
      return isMode(v) ? v : undefined;
    }
    if (a === "--format") {
      const v = argv[i + 1];
      return isMode(v) ? v : undefined;
    }
  }
  return undefined;
}
