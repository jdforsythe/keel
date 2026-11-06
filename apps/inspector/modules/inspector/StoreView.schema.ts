import { s } from "@keel/schema";
import { LogEntry } from "./LogEntry.schema.ts";

/** One store as the inspector shows it: `state` as JSON text, the log oldest first. */
export const StoreView = s.object({ state: s.string(), log: s.array(LogEntry) });
