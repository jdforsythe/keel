import { GROUP_WORDS } from "./GROUP_WORDS.ts";
import { lowerCamel } from "./lowerCamel.ts";

/**
 * The Keel name of the token at `path`: its segments joined in lowerCamel, less a first segment that names its group
 * (`color`, `type`, `spacing`, ...) when others follow it. Empty when the segments hold no letter or digit.
 */
export function tokenName(path: readonly string[]): string {
  const first = path[0];
  const rest = path.length > 1 && first !== undefined && GROUP_WORDS.has(first) ? path.slice(1) : path;
  return lowerCamel(rest);
}
