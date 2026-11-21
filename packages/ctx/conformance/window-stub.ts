// A stub `window` for the ctx owner suites (not a test file). Public API only. Seed 1337 for every property.
// It is an `EventTarget` that records which listeners are live, whether a listener ends through
// `removeEventListener` or through the `signal` it was added with.

type Listener = EventListenerOrEventListenerObject;

export class StubWindow extends EventTarget {
  /** Listeners that became live, by event type. */
  readonly added: string[] = [];
  /** Listeners that stopped being live, by event type. */
  readonly removed: string[] = [];
  private readonly live = new Map<string, Set<Listener>>();

  override addEventListener(
    type: string,
    listener: Listener | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (listener === null) return;
    const signal = typeof options === "object" ? options.signal : undefined;
    if (signal?.aborted === true) return;
    const set = this.live.get(type) ?? new Set<Listener>();
    if (set.has(listener)) return;
    set.add(listener);
    this.live.set(type, set);
    this.added.push(type);
    signal?.addEventListener("abort", () => this.drop(type, listener), { once: true });
    super.addEventListener(type, listener, options);
  }

  override removeEventListener(
    type: string,
    listener: Listener | null,
    options?: boolean | EventListenerOptions,
  ): void {
    if (listener !== null) this.drop(type, listener);
    super.removeEventListener(type, listener, options);
  }

  /** How many listeners of `type` are live now. */
  count(type: string): number {
    return this.live.get(type)?.size ?? 0;
  }

  /** How many listeners are live now, of every type. */
  total(): number {
    let n = 0;
    for (const set of this.live.values()) n += set.size;
    return n;
  }

  private drop(type: string, listener: Listener): void {
    const set = this.live.get(type);
    if (set?.delete(listener) === true) this.removed.push(type);
  }
}

/** The pair of globals a real ctx reads: `window` and `navigator`. */
export type Host = { readonly win: StubWindow; readonly nav: { onLine: boolean } };

export const countOf = (xs: readonly string[], type: string): number => xs.filter((x) => x === type).length;
