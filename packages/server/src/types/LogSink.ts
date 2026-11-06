/**
 * Where the dev log stream goes (k.server Dev server, docs/OUTPUT.md): one line per record, `compact`
 * (`GET /orders/7 orders.show 200 12ms`) or `json` (one NDJSON object per line).
 */
export type LogSink = {
  readonly format: "compact" | "json";
  write(line: string): void;
};
