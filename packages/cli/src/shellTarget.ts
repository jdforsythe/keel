import { shellSlot } from "./internal/shellSlot.ts";
import type { ShellTarget } from "./types/ShellTarget.ts";

/**
 * Register the target of shell `shell` (k.shell Shell target), called once from its package's `./tools` entry,
 * which `keel check` and `keel build` import for each declared shell; it is held for the entry being imported. A
 * second call for that shell there throws E1053.
 */
export function shellTarget(shell: "capacitor" | "tauri", target: ShellTarget): void {
  const held = shellSlot.byFile.get(shellSlot.loading) ?? new Map<"capacitor" | "tauri", ShellTarget>();
  if (held.has(shell)) throw new Error(`E1053 shell target ${shell} registered twice`);
  shellSlot.byFile.set(shellSlot.loading, held.set(shell, target));
}
