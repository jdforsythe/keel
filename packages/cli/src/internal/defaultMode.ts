import type { Io } from "../types/Io.ts";
import type { Mode } from "../types/Mode.ts";

/** compact when stdout is not a TTY or KEEL_AGENT=1, else pretty (OUTPUT.md). */
export function defaultMode(io: Io): Mode {
  return io.tty !== true || io.env?.KEEL_AGENT === "1" ? "compact" : "pretty";
}
