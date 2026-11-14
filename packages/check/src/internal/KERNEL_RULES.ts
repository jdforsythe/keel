import { ariaImport } from "../rules/ariaImport.ts";
import { bodyOnGetEndpoint } from "../rules/bodyOnGetEndpoint.ts";
import { fieldInForm } from "../rules/fieldInForm.ts";
import { foreignUrlAttr } from "../rules/foreignUrlAttr.ts";
import { foreignUrlFetch } from "../rules/foreignUrlFetch.ts";
import { formatInApp } from "../rules/formatInApp.ts";
import { loaderInServerFile } from "../rules/loaderInServerFile.ts";
import { lowContrast } from "../rules/lowContrast.ts";
import { noAmbientCapability } from "../rules/noAmbientCapability.ts";
import { noAmbientLocale } from "../rules/noAmbientLocale.ts";
import { noCodeFromString } from "../rules/noCodeFromString.ts";
import { noDetachedScope } from "../rules/noDetachedScope.ts";
import { noDomGlobal } from "../rules/noDomGlobal.ts";
import { noDomQueryInTest } from "../rules/noDomQueryInTest.ts";
import { noEagerChild } from "../rules/noEagerChild.ts";
import { noInlineStyle } from "../rules/noInlineStyle.ts";
import { noInternalEntry } from "../rules/noInternalEntry.ts";
import { noIntrinsicElement } from "../rules/noIntrinsicElement.ts";
import { noNetFetchInApp } from "../rules/noNetFetchInApp.ts";
import { noRuntimeOpImport } from "../rules/noRuntimeOpImport.ts";
import { noSecretInState } from "../rules/noSecretInState.ts";
import { noThrow } from "../rules/noThrow.ts";
import { noTryCatch } from "../rules/noTryCatch.ts";
import { noUnsafeSyntax } from "../rules/noUnsafeSyntax.ts";
import { oneExport } from "../rules/oneExport.ts";
import { pathParamsMatch } from "../rules/pathParamsMatch.ts";
import { piiInRouteUrl } from "../rules/piiInRouteUrl.ts";
import { pureTransaction } from "../rules/pureTransaction.ts";
import { resourceViaMatch } from "../rules/resourceViaMatch.ts";
import { revealInServerFile } from "../rules/revealInServerFile.ts";
import { revealedValue } from "../rules/revealedValue.ts";
import { reversedFocusOrder } from "../rules/reversedFocusOrder.ts";
import { routeSchemaInferred } from "../rules/routeSchemaInferred.ts";
import { sameAppBaseService } from "../rules/sameAppBaseService.ts";
import { schemaInSchemaFile } from "../rules/schemaInSchemaFile.ts";
import { slotSignature } from "../rules/slotSignature.ts";
import { unsafeJustified } from "../rules/unsafeJustified.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * Kernel per-file rules, registered before any stdlib rule. Codes produced elsewhere in the pipeline:
 * compiler (E1001-E1005, E1401-E1405, E1501), types (E1751, E1453, mapped E1802/E1501/E1001), project
 * passes (E1454, E1508, E1753, E1755; k.module E1151-E1158), runner (E1756), rendered check (E1802).
 */
export const KERNEL_RULES: readonly RuleDef[] = [
  schemaInSchemaFile,
  revealInServerFile,
  formatInApp,
  pureTransaction,
  noSecretInState,
  revealedValue,
  noNetFetchInApp,
  pathParamsMatch,
  bodyOnGetEndpoint,
  sameAppBaseService,
  noThrow,
  noTryCatch,
  noAmbientCapability,
  noCodeFromString,
  noDomQueryInTest,
  oneExport,
  unsafeJustified,
  noUnsafeSyntax,
  noAmbientLocale,
  noInlineStyle,
  noIntrinsicElement,
  noEagerChild,
  lowContrast,
  resourceViaMatch,
  noDetachedScope,
  noRuntimeOpImport,
  noInternalEntry,
  noDomGlobal,
  routeSchemaInferred,
  loaderInServerFile,
  slotSignature,
  fieldInForm,
  piiInRouteUrl,
  foreignUrlAttr,
  foreignUrlFetch,
  reversedFocusOrder,
  ariaImport,
];
