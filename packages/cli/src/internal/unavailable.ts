import type { OutRecord } from "../types/OutRecord.ts";
import { makeDiag } from "./makeDiag.ts";
import { summary } from "./summary.ts";

/** A command whose implementing package has not landed: info I1055 (not an error), exit 0. */
export function unavailable(name: string, needs: string, see: string): OutRecord[] {
  const d = makeDiag("I1055", `${name} not available: needs ${needs}`, { see });
  return [d, summary(name, [d], {})];
}
