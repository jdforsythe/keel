import type { ArrowFunctionExpression, Function as FunctionNode } from "oxc-parser";

/**
 * The function reader the readers that follow a call share (k.privacy-reads Factories, E1107; k.library Ids, E1161):
 * where a name's function is, across imports and re-exports, and what it returns. Each reader keeps its own scope and
 * answer, and reads a function at most `READ_DEPTH` calls deep, a function met again while its read is open not read
 * again (`fnKey` names it in the reader's open set).
 */
export type ReadFn = FunctionNode | ArrowFunctionExpression;
