import type { Schema } from "@keel/schema";
import { A11yReport } from "../evidence/A11yReport.ts";
import { CheckLine } from "../evidence/CheckLine.ts";
import { DepsReport } from "../evidence/DepsReport.ts";
import { LedgerLine } from "../evidence/LedgerLine.ts";
import { PiiReport } from "../evidence/PiiReport.ts";
import { SecurityReport } from "../evidence/SecurityReport.ts";

/** The six files a bundle's manifest lists (k.evidence), each with the schema it parses with; `.ndjson` per line. */
export const BUNDLE_SCHEMAS: ReadonlyMap<string, Schema<unknown>> = new Map<string, Schema<unknown>>([
  ["a11y.json", A11yReport],
  ["check.ndjson", CheckLine],
  ["deps.json", DepsReport],
  ["ledger.ndjson", LedgerLine],
  ["pii.json", PiiReport],
  ["security.json", SecurityReport],
]);
