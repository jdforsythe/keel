import type { Probe } from "./Probe.ts";

/**
 * What a shell target's `tools` reads (k.shell Shell target): the `--platform` given, the build's environment, and
 * `probe`, which runs a command or tests a path (a relative one from the project folder).
 */
export type ShellProbe = {
  readonly platform: string | undefined;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly probe: Probe;
};
