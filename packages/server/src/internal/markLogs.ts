import { stores } from "@keel/store";
import type { LogMark } from "./LogMark.ts";

/** The last log entry of every store in the module registry (call outside any request scope). */
export function markLogs(): LogMark {
  return new Map([...stores().values()].map((st) => [st, st.log().at(-1)]));
}
