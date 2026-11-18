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

/**
 * Queues `e` when its innermost island has not resumed (k.defaults): a `submit` with its default prevented, so it is
 * sent once, at replay (`sent`); a `click` inside an `a[href]` not starting `#` is left to the browser and not queued.
 */
const capture = (e: Event): void => {
  const t = e.target;
  if (!(t instanceof Node)) return;
  const el = t instanceof Element ? t : t.parentElement;
  const island = el?.closest("[data-k-island]") ?? null;
  if (island === null || resumed.has(island)) return;
  const href = e.type === "click" ? el?.closest("a[href]")?.getAttribute("href") : undefined;
  if (href != null && !href.startsWith("#")) return;
  if (e.type === "submit") e.preventDefault();
  entries.push({ event: e, target: t, island });
};

/**
 * After a queued `submit` replayed with no handler calling `preventDefault()`, submits its form natively once, as the
 * browser would have: the submitter's `name` and `value` as a hidden field and its `formaction`, `formmethod`,
 * `formenctype` and `formtarget` on the form for the call, then put back. A form that left the document is not sent.
 */
const sent = (e: Event, t: Node, prevented: boolean): void => {
  if (e.type !== "submit" || prevented || !(t instanceof HTMLFormElement) || !t.isConnected) return;
  const by = e instanceof SubmitEvent ? e.submitter : null;
  const undo = ["action", "method", "enctype", "target"].map((a) => {
    const v = t.getAttribute(a);
    const set = by?.getAttribute(`form${a}`);
    if (set != null) t.setAttribute(a, set);
    return () => (v === null ? t.removeAttribute(a) : t.setAttribute(a, v));
  });
  const pair = document.createElement("input");
  pair.type = "hidden";
  if ((by instanceof HTMLButtonElement || by instanceof HTMLInputElement) && by.name !== "") {
    pair.name = by.name;
    pair.value = by.value;
    t.append(pair);
  }
  HTMLFormElement.prototype.submit.call(t);
  pair.remove();
  for (const u of undo) u();
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
   * calls `stopPropagation`. A queued `submit` is then sent natively unless a handler prevented it (`sent`); any other
   * event no root encloses is dropped. An event whose island has not resumed (a later `resume` call holds it) stays
   * queued for that call's replay.
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
      let prevented = false;
      x.event.preventDefault = () => {
        prevented = true;
      };
      const [inner] = enclosing;
      if (inner !== undefined) {
        roots.get(inner)?.(x.event);
        for (const r of enclosing) if (dispatch(r, x.event, x.target)) break;
      }
      sent(x.event, x.target, prevented);
    }
  },
};
