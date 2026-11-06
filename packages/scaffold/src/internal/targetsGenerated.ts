import { isGenerated } from "./isGenerated.ts";

/** True when an id or path names a generated location: `.keel/x`, `.keel.x`, `turbo.json`, ... */
export function targetsGenerated(idOrPath: string): boolean {
  return /^\.keel(?:[./]|$)/.test(idOrPath) || isGenerated(idOrPath);
}
