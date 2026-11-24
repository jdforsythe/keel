import type { StorageReport } from "@keel/ctx";

/** A driver's one listening connection (std.db): `watch` registers a watcher, opening the connection at the first; `close` ends it. */
export type StorageListening = {
  watch(on: (report: StorageReport) => void): Promise<() => void>;
  close(): Promise<void>;
};
