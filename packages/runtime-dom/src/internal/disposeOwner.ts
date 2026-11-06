import type { Owner } from "./Owner.ts";

/** Dispose `o` and its descendants: children first, then its cleanups in reverse order. Idempotent. */
export function disposeOwner(o: Owner): void {
  if (o.gone && o.children.size === 0 && o.cleanups.length === 0) return;
  o.gone = true;
  o.parent?.children.delete(o);
  for (const c of [...o.children]) disposeOwner(c);
  o.children.clear();
  const cleanups = o.cleanups.splice(0);
  for (let i = cleanups.length - 1; i >= 0; i--) cleanups[i]?.();
}
