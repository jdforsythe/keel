import { crateName, shellDeployables } from "@keel/scaffold";
import type { Diag } from "../internal/Diag.ts";
import { makeDiag } from "../internal/makeDiag.ts";
import type { Input } from "../types/Input.ts";
import type { Probe } from "../types/Probe.ts";
import type { ShellPlan } from "../types/ShellPlan.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { shellOrigin } from "./shellOrigin.ts";
import { toolchain } from "./toolchain.ts";

const NO_PROBE: Probe = { run: () => undefined, exists: () => false, platform: "" };

/**
 * The checks `keel build --target` runs before any work, in order (k.shell Build 1-2): `--platform` given exactly for
 * Capacitor (E1052); `KEEL_ORIGIN` valid (E1574, naming the key and no value); a `client` deployable declaring the
 * shell (E1052); the toolchain (E1575, `probe`; none given: every tool is missing). With no diagnostic, the plan.
 */
export function shellPlan(
  input: Input,
  project: readonly SourceFile[],
  env: Readonly<Record<string, string | undefined>>,
  cwd: string,
  probe: Probe = NO_PROBE,
): { diags: Diag[]; plan: ShellPlan | undefined } {
  const target = input.target === "capacitor" || input.target === "tauri" ? input.target : undefined;
  if (target === undefined) return { diags: [], plan: undefined };
  const fail = (d: Diag): { diags: Diag[]; plan: undefined } => ({ diags: [d], plan: undefined });
  if ((target === "capacitor") !== (input.platform !== undefined))
    return fail(makeDiag("E1052", "--platform android|ios goes with --target capacitor only", { see: "k.shell" }));
  const origin = shellOrigin(env.KEEL_ORIGIN);
  if (origin === undefined)
    return fail(
      makeDiag("E1574", "KEEL_ORIGIN must be an https: origin (http: on localhost only)", { see: "k.shell" }),
    );
  const topology = project.find((f) => f.path === "topology.ts")?.source ?? "";
  const deployables = shellDeployables(topology, target);
  if (deployables.length === 0)
    return fail(makeDiag("E1052", `no client deployable in topology.ts declares shells.${target}`, { see: "k.shell" }));
  const diags = toolchain(target, input.platform, probe, env, cwd);
  if (diags.length > 0) return { diags, plan: undefined };
  const crate = crateName(project.find((f) => f.path === "package.json")?.source);
  return {
    diags: [],
    plan: { target, platform: input.platform, release: input.release === true, origin, deployables, crate },
  };
}
