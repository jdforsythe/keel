import type { TokenGroup } from "../types/TokenGroup.ts";
import { ident } from "./ident.ts";

/** A library's name `<id>.<name>`: an id led by a letter, one `.`, and a name (k.looks Names). */
const LIBRARY = /^([A-Za-z][A-Za-z0-9]*)\.([A-Za-z0-9]+)$/;

/**
 * The custom property holding token `name` of `group`: `--k-space-2`, `--k-motion-fast`, and for a library's name
 * `<id>.<name>` with both parts alphanumeric `--k-<group>-<id>-<name>` (k.looks Names). Any other name with a
 * character outside `[A-Za-z0-9]` is hashed, so the readable forms never collide.
 */
export function varName(group: TokenGroup, name: string): string {
  const lib = LIBRARY.exec(name);
  const parts = lib === null ? [name] : [lib[1] ?? "", lib[2] ?? ""];
  return `--k-${group}-${ident(parts, JSON.stringify([group, name]), true)}`;
}
