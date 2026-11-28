import { type SchemaError, pathToString } from "@keel/schema";
import type { FieldIssue } from "../types/FieldIssue.ts";
import type { Node } from "./Node.ts";
import { fieldIssue } from "./fieldIssue.ts";
import { messageFor } from "./messageFor.ts";
import { nodeAt } from "./nodeAt.ts";

/**
 * Path -> message for every issue (first issue per path wins). An issue on a container (for example a
 * missing object) is also reported on each known field path beneath it, so its bound input shows it. With
 * `issueText`, a message is its return value for the issue; without it, the kernel's English (`messageFor`).
 */
export function issueMessages(
  root: Node,
  issues: SchemaError["data"]["issues"],
  fieldPaths: Iterable<string>,
  issueText?: (issue: FieldIssue) => string,
): Record<string, string> {
  const out: Record<string, string> = {};
  const paths = [...fieldPaths];
  for (const issue of issues) {
    const key = pathToString(issue.path);
    const node = nodeAt(root, issue.path);
    const message = issueText === undefined ? messageFor(node, issue.rule) : issueText(fieldIssue(node, issue));
    if (!Object.hasOwn(out, key)) out[key] = message;
    for (const p of paths) if (key !== "" && p.startsWith(`${key}.`) && !Object.hasOwn(out, p)) out[p] = message;
    if (key === "") for (const p of paths) if (!Object.hasOwn(out, p)) out[p] = message;
  }
  return out;
}
