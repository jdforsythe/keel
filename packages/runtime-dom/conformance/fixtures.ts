// Shared fixtures for k.runtime conformance. Property seed: 1337.
import { scope, signal } from "@keel/reactive";
import { clone, on, template, text } from "@keel/runtime-dom/ops";

export const SEED = 1337;

export type Tracker = { live: () => number; liveOn: (t: EventTarget) => number; stop: () => void };

// Wraps EventTarget.prototype add/removeEventListener and counts net live listeners.
export function trackListeners(): Tracker {
  const proto = EventTarget.prototype;
  const add = proto.addEventListener;
  const remove = proto.removeEventListener;
  const live = new Map<EventTarget, Set<string>>();
  const key = (type: string, l: unknown, opts: unknown): string => {
    const capture =
      typeof opts === "boolean"
        ? opts
        : typeof opts === "object" && opts !== null && "capture" in opts && opts.capture === true;
    return `${type}|${capture}|${ids.get(l) ?? ids.set(l, ids.size).get(l)}`;
  };
  const ids = new Map<unknown, number>();
  proto.addEventListener = function (
    this: EventTarget,
    type: string,
    l: EventListenerOrEventListenerObject | null,
    opts?: boolean | AddEventListenerOptions,
  ) {
    const set = live.get(this) ?? new Set<string>();
    set.add(key(type, l, opts));
    live.set(this, set);
    return add.call(this, type, l, opts);
  };
  proto.removeEventListener = function (
    this: EventTarget,
    type: string,
    l: EventListenerOrEventListenerObject | null,
    opts?: boolean | EventListenerOptions,
  ) {
    live.get(this)?.delete(key(type, l, opts));
    return remove.call(this, type, l, opts);
  };
  return {
    live: () => [...live.values()].reduce((n, s) => n + s.size, 0),
    liveOn: (t) => live.get(t)?.size ?? 0,
    stop: () => {
      proto.addEventListener = add;
      proto.removeEventListener = remove;
    },
  };
}

export const click = (el: Element): void => {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
};

/** Runs `fn` inside an ownership scope (k.reactive E1203); `dispose` frees the scope. */
export const inScope = <T>(fn: () => T): { value: T; dispose: () => void } => {
  const slot: T[] = [];
  const sc = scope(() => {
    slot.push(fn());
  });
  // reduce without a seed yields the single element typed T (throws if fn threw before pushing).
  return { value: slot.reduce((_, x) => x), dispose: () => sc.dispose() };
};

export const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

// Hand-built "compiled" island: a counter that starts at 3 (the server snapshot value).
export const COUNTER_HTML = '<div data-k-island="Counter"><button id="inc" data-k="inc">3</button></div>';
const CounterT = template(COUNTER_HTML);
export const Counter = (): Node => {
  const root = clone(CounterT);
  const n = signal(3);
  const button = root.querySelector("#inc");
  if (button === null) throw new Error("fixture: template lacks #inc");
  text(button, () => String(n.get()));
  on("inc", "click", () => n.set(n.get() + 1));
  return root;
};

export const KSTATE = '<script type="application/json" id="k-state">{"stores":{},"islands":{"Counter":{}}}</script>';
