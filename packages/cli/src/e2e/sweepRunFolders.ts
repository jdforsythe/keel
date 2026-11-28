import { lstatSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { RUN_MARKER } from "./RUN_MARKER.ts";

/** A marked folder of a dead process older than this is what a SIGKILLed run left. */
const STALE_MS = 3_600_000;

/** Whether process `pid` is running (a signal 0 reaches it, or it exists under another user). */
const running = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e instanceof Error && "code" in e && e.code === "EPERM";
  }
};

/** `{ pid, started }` of a marker's text, or undefined when it is not one. */
const markerOf = (text: string): { pid: number; started: number } | undefined => {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return undefined;
  }
  const pid: unknown = typeof v === "object" && v !== null ? Reflect.get(v, "pid") : undefined;
  const started: unknown = typeof v === "object" && v !== null ? Reflect.get(v, "started") : undefined;
  const at = typeof started === "string" ? Date.parse(started) : Number.NaN;
  return typeof pid === "number" && Number.isInteger(pid) && pid > 0 && !Number.isNaN(at)
    ? { pid, started: at }
    : undefined;
};

/**
 * Removes each `keel-e2e-*` folder of `outer` whose marker names a process that is not running and a start more than
 * an hour before `now`: what a SIGKILLed run left. A folder without a marker, a link, or a marker that does not parse
 * is never touched.
 */
export function sweepRunFolders(outer: string, now: number): void {
  let names: string[];
  try {
    names = readdirSync(outer).filter((n) => n.startsWith("keel-e2e-"));
  } catch {
    return;
  }
  for (const name of names) {
    const dir = join(outer, name);
    try {
      if (!lstatSync(dir).isDirectory()) continue;
      const m = markerOf(readFileSync(join(dir, RUN_MARKER), "utf8"));
      if (m !== undefined && now - m.started > STALE_MS && !running(m.pid))
        rmSync(dir, { recursive: true, force: true });
    } catch {
      // unmarked or unreadable: not this sweep's
    }
  }
}
