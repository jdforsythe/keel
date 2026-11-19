import type { KeyValueStorage } from "@keel/ctx";

/**
 * What `sqlite(url)` and `postgres(url)` resolve: k.persist's storage (`get`, `set`, `read`, `commit`) plus `close()`,
 * which the generated entry awaits after `app.close()` at shutdown. Every call after `close()` rejects.
 */
export type DbStorage = KeyValueStorage & { close(): Promise<void> };
