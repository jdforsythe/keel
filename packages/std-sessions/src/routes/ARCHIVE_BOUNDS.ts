/**
 * Bounds of store `sessions.archive` (std.sessions Ingest, invariant `sessions.capped`): 64 fingerprints, the newest
 * 5 sessions of each, and 4 MiB of archive JSON, so one `ctx.storage` key stays within a node localStorage quota
 * (10 MB). Past a bound the fingerprint with the oldest `last` goes; the one this write filed never does.
 */
export const ARCHIVE_BOUNDS = { fingerprints: 64, perFingerprint: 5, bytes: 4 * 1024 * 1024 } as const;
