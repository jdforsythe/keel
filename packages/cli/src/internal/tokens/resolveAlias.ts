import type { DesignFile } from "./DesignFile.ts";
import type { Found } from "./Found.ts";
import { aliasPath } from "./aliasPath.ts";
import { findToken } from "./findToken.ts";

/** The token `start` stands for after following its aliases (itself when its `$value` is no alias), or why not. */
export function resolveAlias(
  files: readonly DesignFile[],
  start: Found,
): Found | { readonly error: "dangling alias" | "circular alias" } {
  const seen = new Set<Found["token"]>([start.token]);
  let at = start;
  for (;;) {
    const path = aliasPath(at.token.value);
    if (path === undefined) return at;
    const next = findToken(files, at.file, path);
    if (next === undefined) return { error: "dangling alias" };
    if (seen.has(next.token)) return { error: "circular alias" };
    seen.add(next.token);
    at = next;
  }
}
