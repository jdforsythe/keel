import type { SourceFile } from "../types/SourceFile.ts";
import { projectLooks } from "./looks/projectLooks.ts";

/** A set label's segments: the group, the set's name whole (a look's may hold `.`, k.looks), then the rest. */
function segments(label: string): string[] {
  const dot = label.indexOf(".");
  if (dot < 0) return [label];
  const group = label.slice(0, dot);
  const rest = label.slice(dot + 1);
  const states = rest.indexOf(".states.");
  const name = states < 0 ? rest : rest.slice(0, states);
  return [group, name, ...(states < 0 ? [] : rest.slice(states + 1).split("."))];
}

/**
 * Where a finding about token set `label` (`look.primary.states.hover`, `base.page`) lands in `file`: the offset of
 * its last path segment found in order, `0` when none is, or `undefined` when `file` is not the project's host for
 * token set findings, so each project reports a set once. The host is its `tokens.ts`, else its first file; a look a
 * listed library ships that `tokens.ts` does not write is hosted by the shipped file, at the look's key (k.looks Own
 * folder).
 */
export function tokenSetAt(file: SourceFile, project: readonly SourceFile[], label: string): number | undefined {
  const host = project.find((f) => /(?:^|\/)tokens\.ts$/.test(f.path)) ?? project[0];
  const parts = segments(label);
  const [group, name = ""] = parts;
  const shipped = group === "look" ? projectLooks.get(project)?.shippedLook(name) : undefined;
  const written = host !== undefined && (host.source.includes(`'${name}'`) || host.source.includes(`"${name}"`));
  if (shipped !== undefined && !written) return file.path === shipped.path ? shipped.at : undefined;
  if (host?.path !== file.path) return undefined;
  let at = 0;
  for (const seg of parts) {
    const i = file.source.indexOf(seg, at);
    if (i >= 0) at = i;
  }
  return at;
}
