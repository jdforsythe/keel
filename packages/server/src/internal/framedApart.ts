import type { Origins } from "@keel/compiler";

/** `origins` without `own` under `frame` (k.origins Frame): the policy of a document never frames its own origin. */
export function framedApart(origins: Origins | undefined, own: string): Origins | undefined {
  if (origins?.frame === undefined || !Object.hasOwn(origins.frame, own)) return origins;
  const frame = Object.fromEntries(Object.entries(origins.frame).filter(([o]) => o !== own));
  return { ...origins, frame };
}
