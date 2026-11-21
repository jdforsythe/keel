/**
 * The most bytes a recorded session's JSON holds: 192 KiB, so an upload fits `sessions.ingest`'s
 * 256 KiB cap with room for a larger redacted value. Past it the buffer cuts its oldest events by the overflow rule.
 */
export const MAX_SESSION_BYTES = 196_608;
