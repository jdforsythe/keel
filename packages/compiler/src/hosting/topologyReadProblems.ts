import { HOST_NOT_LITERAL } from "../internal/HOST_NOT_LITERAL.ts";
import { parseTopology } from "../internal/parseTopology.ts";
import { callerDays } from "./callerDays.ts";

/**
 * The problems `topology.ts` has before it runs, one `[code, deployable, message]` each (`deployable` is `""` for the
 * whole file): E1566 (k.hosting Host) for a `host` that is not a string literal; E1552 (k.topology) for anything else
 * the static read cannot take: a syntax error, no `topology({...})`, a deployable name that is not a literal or not in
 * the one form (`deployableNameProblem`), `modules` or `adapter` that is not a literal; E1578 (k.user) for a `caller`
 * on a deployable other than `node`, or whose `days` is not an integer 1 to 400 (`callerDays`). Build, dev and check
 * call it; a server never parses source.
 */
export function topologyReadProblems(source: string): [string, string, string][] {
  return [
    ...parseTopology(source).problems.map(([name, p]): [string, string, string] => [
      p.endsWith(HOST_NOT_LITERAL) ? "E1566" : "E1552",
      name,
      p,
    ]),
    ...callerDays(source)
      .filter(([, adapter, days]) => adapter !== "node" || !(Number.isInteger(days) && days >= 1 && days <= 400))
      .map(([name]): [string, string, string] => [
        "E1578",
        name,
        `${name}: caller takes { days: an integer 1 to 400 } on a node deployable`,
      ]),
  ];
}
