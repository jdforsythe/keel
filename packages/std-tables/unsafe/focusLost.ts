import { unsafe } from "./unsafe.ts";

/** Whether focus has fallen to no element or the body, as when a new page removes the pager link that held it (std.tables). */
export function focusLost(): boolean {
  return unsafe(
    "std.tables gives the status focus once a new page removes the focused pager link; only the document tells whether focus fell to the body, ctx has no focus read, and the read runs in a microtask after the render, never during it",
    () => document.activeElement === null || document.activeElement === document.body,
  );
}
