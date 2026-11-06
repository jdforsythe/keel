// Vitest's happy-dom environment leaves Node's native `EventTarget` as the global, while DOM nodes extend
// happy-dom's own EventTarget. Align the global so `EventTarget.prototype` is the one nodes actually use
// (the conformance listener tracker patches it). No-op in node-environment files.
if (typeof Node !== "undefined") {
  const domEventTarget: unknown = Object.getPrototypeOf(Node.prototype)?.constructor;
  if (typeof domEventTarget === "function" && domEventTarget !== EventTarget)
    Reflect.set(globalThis, "EventTarget", domEventTarget);
}
