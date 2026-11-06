// Helpers for runtime-dom property tests. Property seed: 1337.
import { scope, signal } from "@keel/reactive";
import type { Signal } from "@keel/reactive";

export const SEED = 1337;

/** A signal owned by a root scope that is never disposed (tests write it from outside any scope). */
export function rootSignal<T>(initial: T): Signal<T> {
  const box: { s: Signal<T> | null } = { s: null };
  scope(() => {
    box.s = signal(initial);
  });
  if (box.s === null) throw new Error("rootSignal: scope did not run");
  return box.s;
}

/** Counts net live listeners added through EventTarget.prototype (see setup.ts) until `stop`. */
export function trackListeners(): { live: () => number; stop: () => void } {
  const proto = EventTarget.prototype;
  const add = proto.addEventListener;
  const remove = proto.removeEventListener;
  const live = new Map<EventTarget, Map<string, number>>();
  const bump = (t: EventTarget, k: string, d: number): void => {
    const m = live.get(t) ?? new Map<string, number>();
    const n = (m.get(k) ?? 0) + d;
    if (n <= 0) m.delete(k);
    else m.set(k, n);
    live.set(t, m);
  };
  const ids = new Map<unknown, number>();
  const key = (type: string, l: unknown, opts: unknown): string => {
    const capture = typeof opts === "boolean" ? opts : typeof opts === "object" && opts !== null && "capture" in opts;
    if (!ids.has(l)) ids.set(l, ids.size);
    return `${type}|${String(capture)}|${ids.get(l)}`;
  };
  proto.addEventListener = function (this: EventTarget, type: string, l, opts) {
    if (!live.get(this)?.has(key(type, l, opts))) bump(this, key(type, l, opts), 1);
    return add.call(this, type, l, opts);
  };
  proto.removeEventListener = function (this: EventTarget, type: string, l, opts) {
    if (live.get(this)?.has(key(type, l, opts))) bump(this, key(type, l, opts), -1);
    return remove.call(this, type, l, opts);
  };
  return {
    live: () => [...live.values()].reduce((n, m) => n + m.size, 0),
    stop: () => {
      proto.addEventListener = add;
      proto.removeEventListener = remove;
    },
  };
}

export const fire = (el: Element, type: string): void => {
  el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
};

export const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};
