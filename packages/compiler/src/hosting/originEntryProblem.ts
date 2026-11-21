import { isExactOrigin } from "./isExactOrigin.ts";
import { isOriginReason } from "./isOriginReason.ts";

/**
 * The E1590 message (k.origins) for one declared entry `origin: reason` under `directive`, else undefined: an origin
 * that is not exact (`isExactOrigin`), or a reason that is not a string of the form `isOriginReason` takes.
 */
export function originEntryProblem(directive: string, origin: string, reason: unknown): string | undefined {
  if (!isExactOrigin(origin)) return `origins.${directive}: ${origin} is not an exact https origin`;
  if (typeof reason !== "string" || !isOriginReason(reason))
    return `origins.${directive}: the reason for ${origin} is not 1 to 200 characters on one line`;
  return undefined;
}
