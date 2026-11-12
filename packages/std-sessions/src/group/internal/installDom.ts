import { Window } from "happy-dom";

/** Globals a Node worker already has that the DOM must own, so an event dispatched on a DOM node is the DOM's. */
const OWNED = new Set(["Event", "CustomEvent", "EventTarget"]);
/** Window keys that name the window itself: each becomes the worker's global. */
const SELF = new Set(["window", "self", "top", "parent", "globalThis", "global"]);

/**
 * Give this worker its own DOM (std.multi: each user has its own DOM): every property of a happy-dom window at
 * `url` the worker's global lacks becomes a global (a method bound to the window), as do `OWNED`; `window` and
 * `self` are the global itself.
 */
export function installDom(url: string): void {
  const win = new Window({ url, settings: { disableErrorCapturing: true } });
  for (const key of Object.getOwnPropertyNames(win)) {
    if (SELF.has(key) || (key in globalThis && !OWNED.has(key))) continue;
    const v: unknown = Reflect.get(win, key);
    const value = typeof v === "function" && !/^[A-Z]/.test(key) ? v.bind(win) : v;
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  for (const key of ["window", "self"])
    Object.defineProperty(globalThis, key, { value: globalThis, configurable: true, writable: true });
}
