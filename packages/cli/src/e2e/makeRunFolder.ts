import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RUN_MARKER } from "./RUN_MARKER.ts";

/** Makes the run folder `keel-e2e-<random>` in the OS temporary folder, marked with this process and `now`. */
export function makeRunFolder(now: number): string {
  const dir = mkdtempSync(join(tmpdir(), "keel-e2e-"));
  writeFileSync(
    join(dir, RUN_MARKER),
    `${JSON.stringify({ pid: process.pid, started: new Date(now).toISOString() })}\n`,
  );
  return dir;
}
