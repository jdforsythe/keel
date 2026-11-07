import { owner } from "@keel/reactive";

const live = new WeakMap<object, Map<string, number>>();

/**
 * Claim a form id within the calling scope's render root (not the process). The first live form with a
 * base id gets it unchanged; further concurrent ones get `~2`, `~3`, ...; disposing the owner frees the claim.
 */
export function claimFormId(base: string): string {
  const here = owner();
  if (here === undefined) return base;
  let root = here;
  while (root.parent !== undefined) root = root.parent;
  const claims = live.get(root) ?? new Map<string, number>();
  live.set(root, claims);
  let n = 1;
  let id = base;
  while (claims.has(id)) {
    n += 1;
    id = `${base}~${n}`;
  }
  claims.set(id, 1);
  here.onDispose(() => claims.delete(id));
  return id;
}
