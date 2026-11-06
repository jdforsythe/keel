import { type SchemaError, pathToString } from "@keel/schema";
import type { Node } from "./Node.ts";
import { messageFor } from "./messageFor.ts";
import { nodeAt } from "./nodeAt.ts";

/**
 * Path -> message for every issue (first issue per path wins). An issue on a container (for example a
 * missing object) is also reported on each known field path beneath it, so its bound input shows it.
 */
export function issueMessages(
  root: Node,
  issues: SchemaError["data"]["issues"],
  fieldPaths: Iterable<string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  const paths = [...fieldPaths];
  for (const issue of issues) {
    const key = pathToString(issue.path);
    const message = messageFor(nodeAt(root, issue.path), issue.rule);
    if (!Object.hasOwn(out, key)) out[key] = message;
    for (const p of paths) if (key !== "" && p.startsWith(`${key}.`) && !Object.hasOwn(out, p)) out[p] = message;
    if (key === "") for (const p of paths) if (!Object.hasOwn(out, p)) out[p] = message;
  }
  return out;
}
