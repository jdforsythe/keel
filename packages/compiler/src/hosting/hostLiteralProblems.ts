import { HOST_NOT_LITERAL } from "../internal/HOST_NOT_LITERAL.ts";
import { parseTopology } from "../internal/parseTopology.ts";

/**
 * The E1566 problems `topology.ts` has before it runs (k.hosting Host): one `[deployable, message]` per `host` in
 * `source` that is not a string literal. Build and check call it; a server never parses source.
 */
export function hostLiteralProblems(source: string): [string, string][] {
  const out: [string, string][] = [];
  for (const p of parseTopology(source).problems)
    if (p.endsWith(`: ${HOST_NOT_LITERAL}`)) out.push([p.slice(0, -HOST_NOT_LITERAL.length - 2), p]);
  return out;
}
