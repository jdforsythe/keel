import { driven } from "./driven.ts";
import { heldOf } from "./heldOf.ts";

/**
 * The `hold` a sim factory gets (k.sim): `hold(label, start)` calls `start`, counts the work it returns held, under
 * `label`, on the ctx family whose clock is `clock`, until it settles, and returns it. Under `simulate` `start` runs
 * in the held work's own async context, so a clock wait it makes is E1728 (k.drive Stalls).
 */
export function holdOn(clock: object): <T>(label: string, start: () => Promise<T>) => Promise<T> {
  return <T>(label: string, start: () => Promise<T>): Promise<T> => {
    const held = heldOf(clock);
    const entry = { label };
    held.push(entry);
    const release = (): void => {
      const at = held.indexOf(entry);
      if (at >= 0) held.splice(at, 1);
    };
    const slot = driven.get(clock);
    let work: Promise<T>;
    try {
      work = slot === undefined ? start() : slot.enter(label, start);
    } catch (e) {
      release();
      return Promise.reject(e);
    }
    work.then(release, release);
    return work;
  };
}
