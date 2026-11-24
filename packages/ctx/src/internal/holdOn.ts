import { heldOf } from "./heldOf.ts";

/**
 * The `hold` a sim factory gets (k.sim): returns `work` and counts it held, under `label`, on the ctx family whose
 * clock is `clock`, until it settles.
 */
export function holdOn(clock: object): <T>(work: Promise<T>, label: string) => Promise<T> {
  return (work, label) => {
    const held = heldOf(clock);
    const entry = { label };
    held.push(entry);
    const release = (): void => {
      const at = held.indexOf(entry);
      if (at >= 0) held.splice(at, 1);
    };
    work.then(release, release);
    return work;
  };
}
