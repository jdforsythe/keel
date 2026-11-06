import { effect } from "@keel/reactive";
import { current } from "./current.ts";
import { report } from "./report.ts";
import { writesOf } from "./writesOf.ts";

/** One binding: an effect in the owning scope that runs `write` (one DOM location); throws go to the Boundary. */
export function bind(op: string, at: string, write: () => void): void {
  const owner = current(op);
  effect(
    () => {
      if (owner.gone) return;
      try {
        write();
      } catch (error) {
        report(owner, error, at);
      }
    },
    { writes: writesOf(owner) },
  );
}
