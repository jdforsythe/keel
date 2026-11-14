/** Event types bound directly on the element instead of delegated (k.runtime Events). */
export const NON_BUBBLING: ReadonlySet<string> = new Set([
  "focus",
  "blur",
  "mouseenter",
  "mouseleave",
  "scroll",
  "load",
  "error",
  "cancel",
  "close",
]);
