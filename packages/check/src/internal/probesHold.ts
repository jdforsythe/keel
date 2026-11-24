import type { Probe } from "./Probe.ts";
import { askDisk } from "./askDisk.ts";

/** Whether every recorded question, asked again, gets the recorded answer (k.check-cache Probes). */
export function probesHold(probes: readonly Probe[]): boolean {
  try {
    return probes.every(([kind, question, answer]) => askDisk(kind, question) === answer);
  } catch {
    return false;
  }
}
