import type { Io } from "../types/Io.ts";
import { loadStd } from "./loadStd.ts";

/** Best effort before MCP lists tools or calls one: load the project's std deps so a filled `session` or `report` slot is served. */
export async function fillStd(provide: () => Io | Promise<Io>): Promise<void> {
  try {
    await loadStd(await provide());
  } catch {
    // a project that cannot be read lists the kernel tools only
  }
}
