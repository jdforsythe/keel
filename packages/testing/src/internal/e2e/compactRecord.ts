import type { LogRecord } from "../../types/LogRecord.ts";

/** A server log record in its compact form (docs/OUTPUT.md Server log): `GET /orders/7 orders.show 200 12ms`. */
export function compactRecord(r: LogRecord): string {
  switch (r.kind) {
    case "req":
      return [r.method, r.path, r.route, String(r.status), `${r.ms}ms`].filter((p) => p !== undefined).join(" ");
    case "diag":
      return `${r.code} ${r.message}`;
    case "csp":
      return r.dropped === undefined
        ? `csp ${r.directive ?? ""} ${r.blocked ?? ""} ${r.route ?? ""}`.trim()
        : `csp dropped ${r.dropped}`;
    case "summary":
      return r.port === undefined ? `ok ${r.name}` : `ok ${r.name} on port ${r.port}`;
    case "other":
      return r.text;
  }
}
