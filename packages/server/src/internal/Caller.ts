import type { LogEntry } from "@keel/store";

/**
 * Who sent one request (finding 0082): `token` is the `keel-caller` cookie value (or one minted for a write that came
 * without it, then `fresh`), undefined for a read without it. `tags` maps each module-store log entry an action of
 * this deployable committed to the token of the caller whose request committed it (`tagSince`).
 */
export type Caller = {
  readonly token: string | undefined;
  readonly fresh: boolean;
  readonly tags: WeakMap<LogEntry, string>;
};
