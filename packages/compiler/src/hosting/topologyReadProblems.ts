import { HOST_NOT_LITERAL } from "../internal/HOST_NOT_LITERAL.ts";
import { parseTopology } from "../internal/parseTopology.ts";

/**
 * The problems `topology.ts` has before it runs, one `[code, deployable, message]` each (`deployable` is `""` for the
 * whole file): E1566 (k.hosting Host) for a `host` that is not a string literal; E1552 (k.topology) for anything else
 * the static read cannot take: a syntax error, no `topology({...})`, a deployable name that is not a literal or not in
 * the one form (`deployableNameProblem`), `modules` or `adapter` that is not a literal. Build, dev and check call it; a
 * server never parses source.
 */
export function topologyReadProblems(source: string): [string, string, string][] {
  return parseTopology(source).problems.map(([name, p]) => [p.endsWith(HOST_NOT_LITERAL) ? "E1566" : "E1552", name, p]);
}
