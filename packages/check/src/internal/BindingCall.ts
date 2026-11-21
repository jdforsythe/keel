import type { CallExpression, ObjectExpression } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { BindingEntry } from "./BindingEntry.ts";

/**
 * One `manifest(contract, binding)` call from `@keel/router` in `file`, read statically: the local name of its
 * contract argument and the specifier that name is imported from (`null` when not an imported identifier), the
 * binding object when it is a literal, its literal entries, and whether a spread or computed key left part unread.
 */
export type BindingCall = {
  readonly file: SourceFile;
  readonly call: CallExpression;
  readonly contract: string | null;
  readonly source: string | null;
  readonly binding: ObjectExpression | null;
  readonly list: readonly BindingEntry[];
  readonly partial: boolean;
};
