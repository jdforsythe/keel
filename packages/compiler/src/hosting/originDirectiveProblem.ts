import { ORIGIN_DIRECTIVES } from "./ORIGIN_DIRECTIVES.ts";

/**
 * The E1590 message (k.origins) for a key of `origins` that is not one of the five directives, else undefined.
 * `script` and `style` are named as not declarable.
 */
export function originDirectiveProblem(key: string): string | undefined {
  return ORIGIN_DIRECTIVES.some((d) => d === key)
    ? undefined
    : `origins.${key}: not declarable; the directives are ${ORIGIN_DIRECTIVES.join(", ")}`;
}
