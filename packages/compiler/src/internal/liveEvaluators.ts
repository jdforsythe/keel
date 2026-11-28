import type { ChildProcess } from "node:child_process";

const live = new Set<ChildProcess>();
const SIGNALS = ["SIGINT", "SIGTERM"] as const;

const killAll = (): void => {
  for (const c of live) c.kill("SIGKILL");
};
/** On an interrupt: every live evaluator ends; with no other listener the command then ends as Node would. */
const onSignal = (signal: NodeJS.Signals): void => {
  killAll();
  if (process.listenerCount(signal) === 1) {
    stopWatching();
    process.kill(process.pid, signal);
  }
};
const startWatching = (): void => {
  process.on("exit", killAll);
  for (const s of SIGNALS) process.on(s, onSignal);
};
function stopWatching(): void {
  process.off("exit", killAll);
  for (const s of SIGNALS) process.off(s, onSignal);
}

/**
 * The command's live evaluators (k.evaluator End): `add` one as it starts, `remove` it once it has ended. While any
 * lives, the command's `exit`, `SIGINT` and `SIGTERM` end each with `SIGKILL`; an interrupt with no other listener
 * then ends the command as it would have ended without this one.
 */
export const liveEvaluators = {
  add(c: ChildProcess): void {
    if (live.size === 0) startWatching();
    live.add(c);
  },
  remove(c: ChildProcess): void {
    if (!live.delete(c)) return;
    if (live.size === 0) stopWatching();
  },
};
