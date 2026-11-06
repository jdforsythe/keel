/**
 * `format` options, mirroring the CLI flags: `mode` (a `FormatMode`; default and any other value: `compact`;
 * typed `string` because callers pass parsed flags), `limit` per-code cap (default 5;
 * json is uncapped unless set), `quiet` trailer only, `code` keep only that code (the summary still counts
 * all), `ms` elapsed time for the trailer (omitted when absent, keeping output deterministic).
 */
export type FormatOptions = {
  readonly mode?: string;
  readonly limit?: number;
  readonly quiet?: boolean;
  readonly code?: string;
  readonly ms?: number;
};
