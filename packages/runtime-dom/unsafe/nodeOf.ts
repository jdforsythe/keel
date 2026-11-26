import { unsafe } from "./unsafe.ts";

/** `v` as a DOM node of any realm (the server's document is not the global one) when it has a `nodeType`, else `undefined`. */
export function nodeOf(v: unknown): Node | undefined {
  if (typeof v !== "object" || v === null || !("nodeType" in v)) return undefined;
  return unsafe(
    "content holds nodes a document made, the browser's or the server's ServerNode, and plain content values carry no nodeType, so an object with nodeType is a Node",
    () => v as Node,
  );
}
