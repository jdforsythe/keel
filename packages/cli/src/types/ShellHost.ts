import type { Diag } from "../internal/Diag.ts";
import type { Probe } from "./Probe.ts";
import type { ShellPlan } from "./ShellPlan.ts";

/** What `keel build --target` needs of the host (k.shell Build): the machine `probe` and the shell build after the web build. */
export type ShellHost = {
  readonly probe: Probe;
  readonly build: (
    cwd: string,
    plan: ShellPlan,
  ) => { code: number; diagnostics: readonly Diag[]; stderr: string; artifacts: readonly string[] };
};
