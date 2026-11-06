import type { TokenGroup } from "../types/TokenGroup.ts";
import { ident } from "./ident.ts";

/** The custom property holding token `name` of `group`: `--k-space-2`, `--k-motion-fast`. */
export function varName(group: TokenGroup, name: string): string {
  return `--k-${group}-${ident([name], JSON.stringify([group, name]), true)}`;
}
