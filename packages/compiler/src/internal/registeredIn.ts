import { pathToFileURL } from "node:url";

const escaped = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Whether `file` (an absolute path) ran a capability's registration (k.data Dev): it is a frame of a stack `register`
 * recorded under `keel dev`, as a path or a `file:` URL, followed by a position, a query or the frame's end. The
 * declaring file and a helper module it called both are.
 */
export function registeredIn(stacks: Iterable<string>, file: string): boolean {
  const at = new RegExp(`(?:${escaped(file)}|${escaped(pathToFileURL(file).href)})(?=[:?)]|\\s|$)`, "m");
  for (const stack of stacks) if (at.test(stack)) return true;
  return false;
}
