import type { ShellApp, ShellJob } from "@keel/scaffold";
import type { ShellBuild } from "./ShellBuild.ts";
import type { ShellProbe } from "./ShellProbe.ts";

/**
 * A shell package's half of `keel check` and `keel build --target` (k.shell Shell target), registered with
 * `shellTarget`: the `--platform` values (`[]` for none), the shell files under `deploy/<name>/<shell>/`, what the
 * machine lacks (each one E1575), the build after the web build, and the CI jobs.
 */
export type ShellTarget = {
  readonly platforms: readonly string[];
  readonly files: (app: ShellApp) => Readonly<Record<string, string>>;
  readonly tools: (at: ShellProbe) => readonly { readonly tool: string; readonly need: string }[];
  readonly build: (at: ShellBuild) => { readonly artifact: string } | { readonly error: string };
  readonly ci: (app: ShellApp) => readonly ShellJob[];
};
