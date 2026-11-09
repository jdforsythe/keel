import { dispatch } from "./dispatch.ts";

/** Bubbling interaction events worth replaying; captured on `document` until their island resumes. */
const QUEUED = [
  "click",
  "dblclick",
  "auxclick",
  "contextmenu",
  "input",
  "beforeinput",
  "change",
  "submit",
  "reset",
  "keydown",
  "keyup",
  "pointerdown",
  "pointerup",
  "mousedown",
  "mouseup",
  "touchstart",
  "touchend",
  "focusin",
  "focusout",
];

/** Input types whose value a user types or picks; buttons, files, hidden and checkables have none to restore. */
const VALUED = /^(?:text|search|email|url|tel|password|number|range|color|date|datetime-local|month|week|time)$/;

/** Whether control `c` holds a value other than the one the server rendered (rfc:0071). */
const offDefault = (c: Element): boolean => {
  if (c instanceof HTMLTextAreaElement) return c.value !== c.defaultValue;
  if (c instanceof HTMLInputElement) return VALUED.test(c.type) && c.value !== c.defaultValue;
  if (!(c instanceof HTMLSelectElement) || c.multiple) return false;
  const first = [...c.options].find((o) => o.defaultSelected) ?? c.options[0];
  return c.value !== (first?.value ?? "");
};

type Entry = { readonly event: Event; readonly target: Node; readonly island: Element };
const entries: Entry[] = [];
const resumed = new WeakSet<Element>();
let installed = false;

const outermostIsland = (from: Element): Element | null => {
  let island = from.closest("[data-k-island]");
  for (
    let up = island?.parentElement?.closest("[data-k-island]");
    up;
    up = up.parentElement?.closest("[data-k-island]")
  )
    island = up;
  return island;
};

const capture = (e: Event): void => {
  const t = e.target;
  if (!(t instanceof Node)) return;
  const el = t instanceof Element ? t : t.parentElement;
  const island = el === null ? null : outermostIsland(el);
  if (island !== null && !resumed.has(island)) entries.push({ event: e, target: t, island });
};

/**
 * Pre-resume event queue (k.runtime: events fired before resume are replayed in order, exactly once).
 * `install` runs once, at import of the module exporting `resume`: the package's one import-time effect.
 */
export const eventQueue = {
  install(): void {
    if (installed || typeof document === "undefined") return;
    installed = true;
    for (const t of QUEUED) document.addEventListener(t, capture, true);
  },
  /** Events waiting for an island to resume. */
  pending(): number {
    return entries.length;
  },
  /** Forget the events queued after the first `n`: resume's own DOM moves fired them (rfc:0064), not the user. */
  drop(n: number): void {
    entries.length = Math.min(entries.length, n);
  },
  /**
   * Mark `island` resumed and replay what happened before through its delegation root `root` (rfc:0071): first a real
   * `input` on each control whose value is off its default with no `input` queued (typed before this queue existed),
   * in document order, then its queued events in order, each passed to `tell` (the observer tap) before dispatch.
   * With `root` null (island fell back to client render, or has no component) its events are dropped.
   */
  resume(island: Element, root: Element | null, tell?: (e: Event) => void): void {
    resumed.add(island);
    const mine = entries.filter((x) => x.island === island);
    for (let i = entries.length - 1; i >= 0; i--) if (entries[i]?.island === island) entries.splice(i, 1);
    if (root === null) return;
    const queued = new Set(mine.flatMap((x) => (x.event.type === "input" ? [x.target] : [])));
    for (const c of island.querySelectorAll("input,textarea,select"))
      if (!queued.has(c) && offDefault(c)) c.dispatchEvent(new Event("input", { bubbles: true }));
    for (const x of mine) {
      tell?.(x.event);
      dispatch(root, x.event, x.target);
    }
  },
};
