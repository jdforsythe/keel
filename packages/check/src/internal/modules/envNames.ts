import { DEPLOY_ENV_KEYS } from "@keel/compiler/hosting/DEPLOY_ENV_KEYS";
import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { ModuleInfo } from "./ModuleInfo.ts";
import { moduleDiag } from "./moduleDiag.ts";
import { short } from "./short.ts";

const NAME = /^[A-Z][A-Z0-9_]*$/;

/** Why `value` cannot be an `env` entry, or undefined when it can (k.server-deps Rules E1167). */
function problem(value: string | null): string | undefined {
  if (value === null) return "env entry is not a string literal";
  if (!NAME.test(value)) return `env name "${short(value)}" does not match [A-Z][A-Z0-9_]*`;
  if (DEPLOY_ENV_KEYS.includes(value) || value.startsWith("KEEL_PEER_"))
    return `env name "${short(value)}" is a key DeployEnv reads`;
  return undefined;
}

/**
 * E1167 (k.server-deps Rules) over every manifest among `modules`, an app module's and a library's: an `env` entry that
 * is not a string literal matching `[A-Z][A-Z0-9_]*`, or that is a `DeployEnv` key or begins with `KEEL_PEER_`, at the
 * entry (its opening quote for a literal). No fix.
 */
export function envNames(modules: readonly ModuleInfo[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const m of modules)
    for (const e of m.manifest?.env ?? []) {
      const why = problem(e.value);
      if (why !== undefined) out.push(moduleDiag("E1167", m.file, e.start, why, undefined, "k.server-deps"));
    }
  return out;
}
