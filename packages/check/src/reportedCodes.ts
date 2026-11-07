import { PIPELINE_CODES } from "./internal/PIPELINE_CODES.ts";
import { registry } from "./internal/registry.ts";

/**
 * Every code `check()` can report (k.check Codes, rfc:0065): the pipeline's own (types, compiler diagnostics,
 * project passes, rule runner) and each registered rule's, sorted. A kernel Rules code not listed here comes
 * from another command and is asserted by its own package's conformance.
 */
export function reportedCodes(): string[] {
  return [...new Set([...PIPELINE_CODES, ...registry.keys()])].sort();
}
