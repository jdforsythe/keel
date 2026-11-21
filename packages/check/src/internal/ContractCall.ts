import type { CallExpression, ObjectExpression } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { ContractEntry } from "./ContractEntry.ts";

/**
 * One `contract(id, entries)` call from `@keel/router/contract` in `file`, read statically: the literal module `id`
 * (`null` when not a string literal), the `entries` object when it is a literal (also through a top-level `const`),
 * its literal entries, the name it is exported as (`null` when it is not the initializer of an exported `const`) and
 * whether a spread or computed key left part of it unread.
 */
export type ContractCall = {
  readonly file: SourceFile;
  readonly call: CallExpression;
  readonly id: string | null;
  readonly entries: ObjectExpression | null;
  readonly list: readonly ContractEntry[];
  readonly exported: string | null;
  readonly partial: boolean;
};
