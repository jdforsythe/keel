import { spawnSync } from "node:child_process";

/**
 * Stops every process this one started, children first then theirs (each descendant by `ps`, SIGKILL): the servers,
 * browsers and workers of the run. Returns how many it signalled.
 */
export function stopDescendants(): number {
  const ps = spawnSync("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8" });
  if (ps.status !== 0) return 0;
  const kids = new Map<number, number[]>();
  for (const line of ps.stdout.split("\n")) {
    const [pid, ppid] = line.trim().split(/\s+/).map(Number);
    if (pid === undefined || ppid === undefined || Number.isNaN(pid) || Number.isNaN(ppid)) continue;
    kids.set(ppid, [...(kids.get(ppid) ?? []), pid]);
  }
  const all: number[] = [];
  const walk = (pid: number): void => {
    for (const k of kids.get(pid) ?? []) {
      if (k === ps.pid) continue;
      all.push(k);
      walk(k);
    }
  };
  walk(process.pid);
  let n = 0;
  for (const pid of all.reverse()) {
    try {
      process.kill(pid, "SIGKILL");
      n++;
    } catch {
      // gone already
    }
  }
  return n;
}
