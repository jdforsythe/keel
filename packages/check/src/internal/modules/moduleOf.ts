import type { ModuleInfo } from "./ModuleInfo.ts";

/** The module a path belongs to: the one with the longest root that prefixes it, or `undefined`. */
export function moduleOf(path: string, modules: readonly ModuleInfo[]): ModuleInfo | undefined {
  let best: ModuleInfo | undefined;
  for (const m of modules) {
    if (path.startsWith(m.root) && (best === undefined || m.root.length > best.root.length)) best = m;
  }
  return best;
}
