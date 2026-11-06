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
  /**
   * Mark `island` resumed and replay its queued events through its delegation root `root`, in order.
   * With `root` null (island fell back to client render, or has no component) its events are dropped.
   */
  resume(island: Element, root: Element | null): void {
    resumed.add(island);
    const mine = entries.filter((x) => x.island === island);
    for (let i = entries.length - 1; i >= 0; i--) if (entries[i]?.island === island) entries.splice(i, 1);
    if (root !== null) for (const x of mine) dispatch(root, x.event, x.target);
  },
};
