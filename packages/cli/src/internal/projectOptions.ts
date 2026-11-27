import { resolve, sep } from "node:path";
import { ancestorKeys, managerWord, workspaceOf } from "@keel/scaffold/create";
import type { Io } from "../types/Io.ts";

/**
 * What `keel scaffold project <dir>` reads as `create-app` does (k.scaffold `project`, k.create-manager Package manager and
 * Workspace): the `packageManager` that `npm_config_user_agent` gives, whether `dir` is inside a workspace (`member`),
 * whether the root's globs leave it out (`outside`), and the version of the `@keel/cli` that resolves from its parent.
 * The Workspace files above it are read through `io.read`.
 */
export function projectOptions(
  io: Io,
  dir: string,
): {
  readonly packageManager: string | undefined;
  readonly member: boolean;
  readonly outside: boolean;
  readonly cli: string | undefined;
} {
  const depth = resolve(io.cwd)
    .split(sep)
    .filter((s) => s !== "").length;
  const ancestors: Record<string, string> = {};
  for (const key of ancestorKeys(dir === "" ? "." : dir, depth)) {
    const text = io.read?.(key);
    if (text !== undefined) ancestors[key] = text;
  }
  const ws = workspaceOf(dir === "" ? "." : dir, ancestors);
  const member = ws.root !== undefined;
  return {
    packageManager: member ? undefined : managerWord(io.env?.npm_config_user_agent).packageManager,
    member,
    outside: member && !ws.member,
    cli: ws.cli,
  };
}
