import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { Analysis } from "../Analysis.ts";
import { diag } from "../diag.ts";

const SERVER_FILE = /\.server\.[cm]?[jt]sx?$/;
const SERVER_SPEC = /\.server(?:\.[cm]?[jt]sx?)?$/;

/**
 * E1004: a `*.server.ts` module imported from a module that is not itself a server module (ADR-0006).
 * `clientOnly`: the file's deployables declare no server (`adapter: 'client'`), so nothing is reported.
 */
export function ruleServerImport(a: Analysis, clientOnly = false): Diagnostic[] {
  if (clientOnly || SERVER_FILE.test(a.path)) return [];
  const out: Diagnostic[] = [];
  for (const i of a.imports) {
    if (i.importKind === "type" || !SERVER_SPEC.test(i.source.value)) continue;
    out.push(diag(a, "E1004", i.start, `client code imports server module ${i.source.value}`, "k.compiler"));
  }
  return out;
}
