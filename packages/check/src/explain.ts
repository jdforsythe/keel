import { EXPLANATIONS } from "./internal/EXPLANATIONS.ts";
import { registrations } from "./internal/registrations.ts";

/**
 * `keel explain <code>` (k.check): at most 120 tokens naming the code. Kernel codes read the spec-derived
 * table; registered stdlib rules give their message, `explain`, and `see`. Unknown codes say so.
 */
export function explain(code: string): string {
  const kernel = EXPLANATIONS.get(code);
  if (kernel !== undefined) return kernel;
  const rule = registrations.get(code);
  if (rule === undefined) return `${code} is not a known code; keel spec --for ${code} lists spec lines citing it.`;
  const message = typeof rule.message === "string" ? `${code} ${rule.message}.` : `${code}.`;
  return [message, rule.explain ?? "", ...(rule.see === undefined ? [] : [`see: ${rule.see}`])].join("\n");
}
