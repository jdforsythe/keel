import type { HarnessArtifacts } from "../types/HarnessArtifacts.ts";

/**
 * The project's artifacts as the `keel test` setup read them (k.a11y Artifacts): those present, or why `tokens.ts`
 * is unusable (each render given no `artifacts` then throws E1807 with that reason).
 */
export type ProjectArtifacts =
  | { readonly ok: true; readonly artifacts: HarnessArtifacts }
  | { readonly ok: false; readonly reason: string };
