import { isAbsolute, join } from "node:path";
import type { Diag } from "../internal/Diag.ts";
import { makeDiag } from "../internal/makeDiag.ts";
import type { shellTargets } from "../internal/shellTargets.ts";
import type { Input } from "../types/Input.ts";
import type { Probe } from "../types/Probe.ts";
import type { ShellPlan } from "../types/ShellPlan.ts";
import { shellOrigin } from "./shellOrigin.ts";

const NO_PROBE: Probe = { run: () => undefined, exists: () => false, platform: "" };

/**
 * The checks `keel build --target` runs before any work, in order (k.shell Build 1-3): the shell targets load
 * (`loaded`: E1159, E1585), a `client` deployable declares the shell (E1052), `--platform` is one of the target's
 * `platforms`, and given when it has some (E1052); `KEEL_ORIGIN` is valid (E1574, naming the key and no value); the
 * target's `tools` over `probe` (a relative path read from `cwd`; none given: nothing runs or exists), each entry one
 * E1575. With no diagnostic, the plan, one app per declaring deployable from `loaded`'s apps.
 */
export function shellPlan(
  input: Input,
  env: Readonly<Record<string, string | undefined>>,
  cwd: string,
  loaded: Awaited<ReturnType<typeof shellTargets>>,
  probe: Probe = NO_PROBE,
): { diags: Diag[]; plan: ShellPlan | undefined } {
  const target = input.target === "capacitor" || input.target === "tauri" ? input.target : undefined;
  if (target === undefined) return { diags: [], plan: undefined };
  const fail = (d: Diag): { diags: Diag[]; plan: undefined } => ({ diags: [d], plan: undefined });
  if (loaded.diags.length > 0) return { diags: loaded.diags, plan: undefined };
  const apps = loaded.apps.filter((a) => a.shell === target).map((a) => a.app);
  const shell = loaded.targets[target];
  if (apps.length === 0 || shell === undefined)
    return fail(makeDiag("E1052", `no client deployable in topology.ts declares shells.${target}`, { see: "k.shell" }));
  const { platforms } = shell;
  const p = input.platform;
  if (p === undefined ? platforms.length > 0 : !platforms.includes(p))
    return fail(
      makeDiag(
        "E1052",
        platforms.length === 0
          ? `--target ${target} takes no --platform`
          : `--target ${target} needs --platform ${platforms.join("|")}`,
        { see: "k.shell" },
      ),
    );
  const origin = shellOrigin(env.KEEL_ORIGIN);
  if (origin === undefined)
    return fail(
      makeDiag("E1574", "KEEL_ORIGIN must be an https: origin (http: on localhost only)", { see: "k.shell" }),
    );
  const at: Probe = { ...probe, exists: (path) => probe.exists(isAbsolute(path) ? path : join(cwd, path)) };
  const diags = shell
    .tools({ platform: p, env, probe: at })
    .map((t) => makeDiag("E1575", `${t.tool} missing or too old: needs ${t.need}`, { see: "k.shell" }));
  if (diags.length > 0) return { diags, plan: undefined };
  return { diags: [], plan: { target, shell, platform: p, release: input.release === true, origin, apps } };
}
