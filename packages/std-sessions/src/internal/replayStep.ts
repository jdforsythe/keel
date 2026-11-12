import type { Recorder } from "../Recorder.ts";
import type { SessionEvent } from "../SessionEvent.ts";
import { isInput } from "./isInput.ts";

/** An event without its time: two events with one key are one occurrence's report. */
const key = (e: SessionEvent): string => JSON.stringify({ ...e, at: 0 });

/**
 * One step of a replay over recorded events (std.sessions `replay`), with `rec` the replay's own recorder. An input
 * the replay already recorded as the effect of the input applied before it (the `submit` a click on a submit button
 * dispatches, the `nav` an action ends with, each recorded live after that input) happened again on its own: it is
 * passed over as applied, with the effects recorded before it. Any other input goes to `apply`. Observations apply as
 * nothing. Resolves false when `apply` does.
 */
export function replayStep(
  rec: Recorder,
  apply: (e: SessionEvent) => Promise<boolean>,
): (e: SessionEvent) => Promise<boolean> {
  let seen = rec.events().length;
  let effects: string[] = [];
  /** Adds the inputs recorded since the last read to `effects`. */
  const read = (): void => {
    const all = rec.events();
    effects.push(...all.slice(seen).filter(isInput).map(key));
    seen = all.length;
  };
  return async (e) => {
    const k = key(e);
    read();
    const i = effects.indexOf(k);
    effects = effects.slice(i + 1);
    if (i >= 0 || !isInput(e)) return true;
    const ok = await apply(e);
    read();
    // The applied input's own report is the first of its key; the rest is its effect.
    const own = effects.indexOf(k);
    if (own >= 0) effects.splice(own, 1);
    return ok;
  };
}
