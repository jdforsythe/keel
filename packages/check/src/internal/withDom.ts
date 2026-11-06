import { Window } from "happy-dom";

const GLOBALS = [
  "window",
  "document",
  "Node",
  "Element",
  "HTMLElement",
  "Text",
  "Comment",
  "DocumentFragment",
  "Event",
  "CustomEvent",
  "MutationObserver",
  "getComputedStyle",
] as const;

/**
 * Run `fn` with a DOM: the ambient one when `document` exists (test environments), else a fresh happy-dom
 * window installed on `globalThis` for the duration of the call and removed after.
 */
export function withDom<T>(fn: (doc: Document) => T): T {
  if (typeof document !== "undefined") return fn(document);
  const win = new Window({ url: "http://localhost/" });
  const saved = GLOBALS.map((k) => [k, Reflect.get(globalThis, k)] as const);
  for (const k of GLOBALS) Reflect.set(globalThis, k, Reflect.get(win, k));
  try {
    return fn(Reflect.get(globalThis, "document"));
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) Reflect.deleteProperty(globalThis, k);
      else Reflect.set(globalThis, k, v);
    }
    void win.happyDOM.close();
  }
}
