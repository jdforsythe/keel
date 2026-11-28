import type { ShellTarget } from "../types/ShellTarget.ts";

/**
 * The registered shell targets (k.shell Shell target), by the `./tools` file whose import registered them, then by
 * shell. `loading` is the file `shellTargets` is importing, `""` outside one. Each project reads the targets of the
 * files its own root resolves, so a process serving two projects (LSP, MCP) holds each one's own.
 */
export const shellSlot: { loading: string; readonly byFile: Map<string, Map<"capacitor" | "tauri", ShellTarget>> } = {
  loading: "",
  byFile: new Map(),
};
