import { dispatch } from "./dispatch.ts";

/** Bubbling interaction events worth replaying; captured on `document` until their (innermost) island resumes. */
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
/** Delegation roots resumed or re-rendered, each with its observer tap. */
const roots = new WeakMap<Element, ((e: Event) => void) | undefined>();
let installed = false;

const capture = (e: Event): void => {
  const t = e.target;
  if (!(t instanceof Node)) return;
  const el = t instanceof Element ? t : t.parentElement;
  const island = el?.closest("[data-k-island]") ?? null;
  if (island !== null && !resumed.has(island)) entries.push({ event: e, target: t, island });
};

/**
 * Pre-resume event queue (k.runtime: events fired before resume are replayed in order, exactly once; k.resume Replay).
 * `install` runs once, at import of the module exporting `resume`: the package's one import-time effect.
 */
export const eventQueue = {
  install(): void {
    if (installed || typeof document === "undefined") return;
    installed = true;
    for (const t of QUEUED) document.addEventListener(t, capture, true);
  },
  /** Events waiting for replay. */
  pending(): number {
    return entries.length;
  },
  /** Forget the events queued after the first `n`: resume's own DOM moves fired them (rfc:0064), not the user. */
  drop(n: number): void {
    entries.length = Math.min(entries.length, n);
  },
  /**
   * Mark `island` resumed with its delegation root `root` and observer tap `tell`, then fire a real `input` on each
   * of its own controls (not a nested island's) whose value is off its default with no `input` queued (typed before
   * this queue existed), in document order (rfc:0071). Its queued events wait for `replay`. With `root` null (the
   * island re-rendered on the client, or has no component) its queued events whose target left the document are
   * dropped.
   */
  resume(island: Element, root: Element | null, tell?: (e: Event) => void): void {
    resumed.add(island);
    if (root === null) {
      for (let i = entries.length - 1; i >= 0; i--) {
        const x = entries[i];
        if (x !== undefined && x.island === island && !x.target.isConnected) entries.splice(i, 1);
      }
      return;
    }
    roots.set(root, tell);
    const queued = new Set(entries.flatMap((x) => (x.island === island && x.event.type === "input" ? [x.target] : [])));
    for (const c of island.querySelectorAll("input,textarea,select"))
      if (c.closest("[data-k-island]") === island && !queued.has(c) && offDefault(c))
        c.dispatchEvent(new Event("input", { bubbles: true }));
  },
  /** Register the delegation root `root` of a client re-render, so replayed events reach its handlers. */
  root(root: Element, tell: (e: Event) => void): void {
    roots.set(root, tell);
  },
  /**
   * Replay every queued event once, in the order they fired, each as a live one: told to the observer of its innermost
   * enclosing root, then dispatched from its target through each enclosing root, innermost first, until a handler
   * calls `stopPropagation`. An event no root encloses is dropped. An event whose island has not resumed (a later
   * `resume` call holds it) stays queued for that call's replay.
   */
  replay(): void {
    const ready = entries.filter((x) => resumed.has(x.island));
    const waiting = entries.filter((x) => !resumed.has(x.island));
    entries.length = 0;
    entries.push(...waiting);
    for (const x of ready) {
      const enclosing: Element[] = [];
      for (let n: Node | null = x.target; n !== null; n = n.parentNode)
        if (n instanceof Element && roots.has(n)) enclosing.push(n);
      const [inner] = enclosing;
      if (inner === undefined) continue;
      roots.get(inner)?.(x.event);
      for (const r of enclosing) if (dispatch(r, x.event, x.target)) break;
    }
  },
};
