import { s } from "@keel/schema";

/** The error a failed outbox entry keeps, as far as the list reads it: its code, and the status of an answer the API refused. */
export const Refusal = s.object({ code: s.string(), data: s.object({ status: s.int().optional() }) });
