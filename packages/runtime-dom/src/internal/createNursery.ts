import { effect, signal } from "@keel/reactive";
import type { Nursery } from "./Nursery.ts";

/**
 * k.reactive disposes an effect's children on every rerun and offers no way to re-enter an owner, so a
 * keyed list's reconcile effect cannot own its rows. A nursery owns them instead: a chain of one-shot
 * "link" effects created in the list's stable scope. The head link subscribes to `tick`; `spawn` queues
 * `fn` and bumps `tick`; the head link then runs every queued `fn` (their primitives become its children),
 * creates the next link, and never reruns because it no longer reads anything. Everything happens inside
 * the same commit. Cost: one idle effect node per spawning commit, freed with the nursery's scope.
 */
export function createNursery(): Nursery {
  const tick = signal(0);
  const pending: (() => void)[] = [];
  let count = 0;
  const link = (): void => {
    let armed = false;
    effect(() => {
      if (!armed && pending.length === 0) {
        armed = true;
        tick.get();
        return;
      }
      for (const fn of pending.splice(0)) fn();
      link();
    });
  };
  link();
  return {
    tick,
    spawn(fn) {
      pending.push(fn);
      tick.set(++count);
    },
  };
}
