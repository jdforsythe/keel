import type { ShellApp } from "@keel/scaffold";
import type { ShellTarget } from "./ShellTarget.ts";

/**
 * A shell build after its checks pass (k.shell Build 1-3): the shell and its registered target, `--platform`,
 * `--release`, the build's `KEEL_ORIGIN` origin, and the app of each `client` deployable declaring the shell.
 */
export type ShellPlan = {
  readonly target: "capacitor" | "tauri";
  readonly shell: ShellTarget;
  readonly platform: string | undefined;
  readonly release: boolean;
  readonly origin: string;
  readonly apps: readonly ShellApp[];
};
