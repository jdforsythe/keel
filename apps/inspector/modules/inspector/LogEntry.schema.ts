import { s } from "@keel/schema";

/** One store log entry (k.store `log()`); its payload is not shown, so it is not declared. */
export const LogEntry = s.object({ id: s.int(), name: s.string(), at: s.number() });
