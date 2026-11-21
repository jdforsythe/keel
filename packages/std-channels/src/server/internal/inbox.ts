import type { ChannelEvent } from "../../ChannelEvent.ts";

/** The events a stream holds before its reader takes them; past this the stream ends and its client re-reads. */
const MAX_PENDING = 256;

/**
 * A stream's pending events. `next` resolves the oldest, or undefined once `signal` aborts or the inbox overflowed
 * (`MAX_PENDING` unread events: a reader that stopped reading ends instead of holding memory). A wait leaves no
 * listener on `signal` once it ends.
 */
export function inbox<M>() {
  const items: ChannelEvent<M>[] = [];
  let wake = (): void => undefined;
  let over = false;
  return {
    push(event: ChannelEvent<M>): void {
      if (items.length >= MAX_PENDING) over = true;
      else items.push(event);
      wake();
    },
    async next(signal: AbortSignal): Promise<ChannelEvent<M> | undefined> {
      while (items.length === 0 && !over && !signal.aborted)
        await new Promise<void>((r) => {
          const done = (): void => {
            signal.removeEventListener("abort", done);
            r();
          };
          wake = done;
          signal.addEventListener("abort", done, { once: true });
        });
      return over || signal.aborted ? undefined : items.shift();
    },
  };
}
