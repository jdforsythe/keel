import type { Computed } from "@keel/reactive";
import { isReadable } from "./isReadable.ts";

/** The string a `value` prop holds now: a signal/computed's value, the string, or "" when absent. */
export function plain(v: string | Computed<string> | undefined): string {
  return isReadable(v) ? v.get() : (v ?? "");
}
