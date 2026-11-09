/**
 * Bounds of store `sessions.archive` (std.sessions Ingest, invariant `sessions.capped`): 64 fingerprints, 5 sessions
 * each, and 4 MiB of archive JSON, so one `ctx.storage` key stays within a node localStorage quota (10 MB). One
 * caller holds at most 1 MiB of sessions in at most 16 fingerprints, so no single caller fills the archive.
 */
export const ARCHIVE_BOUNDS = {
  fingerprints: 64,
  perFingerprint: 5,
  bytes: 4 * 1024 * 1024,
  callerBytes: 1024 * 1024,
  callerFingerprints: 16,
} as const;
