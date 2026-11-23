import type { SourceFile } from "../types/SourceFile.ts";

/**
 * Where a finding about token set `label` (`look.primary.states.hover`, `base.page`) lands in `file`: the offset of
 * its last path segment found in order, `0` when none is, or `undefined` when `file` is not the project's host for
 * token set findings (its `tokens.ts`, else its first file), so each project reports a set once.
 */
export function tokenSetAt(file: SourceFile, project: readonly SourceFile[], label: string): number | undefined {
  const host = project.find((f) => /(?:^|\/)tokens\.ts$/.test(f.path)) ?? project[0];
  if (host?.path !== file.path) return undefined;
  let at = 0;
  for (const seg of label.split(".")) {
    const i = file.source.indexOf(seg, at);
    if (i >= 0) at = i;
  }
  return at;
}
