import type { Artifacts } from "./Artifacts.ts";
import type { Diagnostic } from "./Diagnostic.ts";
import type { Output } from "./Output.ts";

/** Result of `compile`: outputs in input order, artifacts, a content hash per artifact, sorted diagnostics. */
export type CompileResult = {
  artifacts: Artifacts;
  diagnostics: Diagnostic[];
  hashes: Record<keyof Artifacts, string>;
  outputs: Output[];
};
