import { stores } from "@keel/store";
import type { Caller } from "./Caller.ts";
import type { LogMark } from "./LogMark.ts";

/**
 * Tag every module-store log entry committed since `mark` with `caller`'s token (finding 0082). A store whose marked
 * last entry is gone (undone or restored meanwhile) gets no tags: nothing it holds is provably this caller's.
 */
export function tagSince(mark: LogMark, caller: Caller): void {
  const token = caller.token;
  if (token === undefined) return;
  for (const st of stores().values()) {
    const log = st.log();
    const last = mark.get(st);
    const from = last === undefined ? 0 : log.lastIndexOf(last) + 1;
    if (last !== undefined && from === 0) continue;
    for (const e of log.slice(from)) caller.tags.set(e, token);
  }
}
