import { noAmbientCapability } from "../rules/noAmbientCapability.ts";
import { noDomQueryInTest } from "../rules/noDomQueryInTest.ts";
import { noInlineStyle } from "../rules/noInlineStyle.ts";
import { noIntrinsicElement } from "../rules/noIntrinsicElement.ts";
import { noThrow } from "../rules/noThrow.ts";
import { noTryCatch } from "../rules/noTryCatch.ts";
import { oneExport } from "../rules/oneExport.ts";
import { pureTransaction } from "../rules/pureTransaction.ts";
import { schemaInSchemaFile } from "../rules/schemaInSchemaFile.ts";
import { unsafeJustified } from "../rules/unsafeJustified.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * Kernel per-file rules, registered before any stdlib rule. Codes produced elsewhere in the pipeline:
 * compiler (E1001-E1005, E1401-E1404, E1501), types (E1751, E1453, mapped E1802/E1501/E1001), project
 * passes (E1454, E1753, E1755), runner (E1756), rendered check (E1802).
 */
export const KERNEL_RULES: readonly RuleDef[] = [
  schemaInSchemaFile,
  pureTransaction,
  noThrow,
  noTryCatch,
  noAmbientCapability,
  noDomQueryInTest,
  oneExport,
  unsafeJustified,
  noInlineStyle,
  noIntrinsicElement,
];
