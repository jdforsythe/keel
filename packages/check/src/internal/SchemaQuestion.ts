import type { Argument, CallExpression } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { SchemaAnswer } from "./SchemaAnswer.ts";

/**
 * What `schemaRead` asks of each part of a schema. `pkg` answers an export of a package the walk reaches (`name` `*`
 * for a namespace import), `global` a name the file never declares. `call`, when given, answers a call before the
 * walk reads its receiver and arguments; `undefined` reads on, and `read` walks a part of it with the same question.
 */
export type SchemaQuestion = {
  readonly pkg: (at: { readonly package: string; readonly name: string }) => SchemaAnswer;
  readonly global: SchemaAnswer;
  readonly call?: (
    e: CallExpression,
    file: SourceFile,
    read: (x: Argument) => SchemaAnswer,
  ) => SchemaAnswer | undefined;
};
