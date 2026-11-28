import type { Origins } from "@keel/compiler";

/**
 * The first origin `origins` declares under `frame` that is one of `own`, the app's own origins (k.origins Frame), else
 * undefined. A frame of the app's own origin runs with the document's origin, so its sandbox holds nothing back.
 */
export function ownFrame(origins: Origins | undefined, own: ReadonlySet<string>): string | undefined {
  return Object.keys(origins?.frame ?? {}).find((o) => own.has(o));
}
