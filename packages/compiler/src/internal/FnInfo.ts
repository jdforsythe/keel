import type { ArrowFunctionExpression } from "oxc-parser";
import type { Function as FunctionNode } from "oxc-parser";
import type { Span } from "./Span.ts";

/** A function in the file and the name it is known by (declaration id or variable name). */
export type FnInfo = Span & { name: string | null; node: FunctionNode | ArrowFunctionExpression };
