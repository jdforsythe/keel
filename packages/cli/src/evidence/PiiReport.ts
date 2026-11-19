import { s } from "@keel/schema";

const RUNG = s.enum(["none", "monitored", "example", "probabilistic", "exhaustive", "proven"]);

/**
 * `pii.json` (k.evidence, k.privacy): each `.pii()` path of the app's schema exports with its class, each sink with
 * the clause that proves its redaction and that clause's rung, and `coverage`, the share of (path, sink) pairs whose
 * clause is `probabilistic` or higher, and the `*.schema.ts` files that failed to import (`unread`).
 */
export const PiiReport = s.object({
  v: s.literal(1),
  paths: s.array(s.object({ file: s.string(), export: s.string(), path: s.string(), class: s.string() })),
  sinks: s.array(s.object({ sink: s.string(), clause: s.string(), rung: RUNG })),
  coverage: s.number({ min: 0, max: 1 }),
  unread: s.array(s.string()),
});
