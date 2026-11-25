import { s } from "@keel/schema";

/** A rung: one of the six names of k.ledger Ledger. */
export const RUNG = s.enum(["none", "example", "probabilistic", "exhaustive", "proven", "monitored"]);
