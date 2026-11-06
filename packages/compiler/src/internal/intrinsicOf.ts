import type { JSXElement } from "oxc-parser";
import type { Analysis } from "./Analysis.ts";
import type { IntrinsicKind } from "./IntrinsicKind.ts";

/** Which control-flow intrinsic a JSX element is, when its tag is a name imported from `@keel/runtime-dom`. */
export function intrinsicOf(a: Analysis, el: JSXElement): IntrinsicKind | undefined {
  const n = el.openingElement.name;
  return n.type === "JSXIdentifier" ? a.intrinsics.get(n.name) : undefined;
}
