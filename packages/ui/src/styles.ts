import { classesOf } from "./internal/classesOf.ts";
import { hasEvery } from "./internal/hasEvery.ts";
import type { StyleProps } from "./types/StyleProps.ts";

/**
 * File-local scoped styles: `const css = styles({ card: { p: '3', radius: '1' } })`, applied with
 * `class={css.card}`. Same vocabulary and atomic classes as style props; static values only.
 */
export function styles<const K extends string>(
  def: Readonly<Record<K, StyleProps<never>>>,
): Readonly<Record<K, string>> {
  const keys: K[] = [];
  const out: Partial<Record<K, string>> = {};
  for (const k in def) {
    keys.push(k);
    out[k] = classesOf(def[k]).join(" ");
  }
  if (!hasEvery(out, keys)) throw new Error("styles: unreachable, every key was assigned");
  return out;
}
