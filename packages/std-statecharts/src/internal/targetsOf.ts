import type { LooseState } from "./LooseState.ts";

type Entry = NonNullable<LooseState["on"]>[string];

/** The targets of one `on` entry in the order they are tried, a bare state name read as `{ to }`. */
export function targetsOf(
  entry: Entry,
): readonly { readonly to?: string; readonly guard?: string; readonly do?: string }[] {
  const list = typeof entry === "string" || entry === undefined || !Array.isArray(entry) ? [entry] : entry;
  return list.flatMap((t) => (t === undefined ? [] : typeof t === "string" ? [{ to: t }] : [t]));
}
