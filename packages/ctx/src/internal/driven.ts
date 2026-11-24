import type { Ctx } from "../Ctx.ts";
import { realmShared } from "./realmShared.ts";

/**
 * What `simulate` (`@keel/testing`) fills in for a run's ctx family, keyed by its clock: `enter` runs held work's
 * `start` in the held work's own async context, `waited` hears each `clock.after`, `replica` each replica made. A
 * sim ctx outside `simulate` has none: it is never driven (k.drive).
 */
export const driven: WeakMap<
  object,
  {
    readonly enter: <T>(label: string, start: () => Promise<T>) => Promise<T>;
    readonly waited: () => void;
    readonly replica: (made: Ctx) => void;
  }
> = realmShared("keel.driven");
