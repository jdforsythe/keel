/** Options of `record` (std.sessions API): ring buffer `limit` (default 500); `upload` puts the session on the first error. */
export interface RecordOptions {
  readonly limit?: number;
  readonly upload?: URL;
}
