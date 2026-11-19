import type { Ctx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { type KeelError, type Result, err } from "@keel/schema";
import { isolate } from "../isolate.ts";
import { openHeld } from "./openHeld.ts";
import { saveStores } from "./saveStores.ts";
import type { SaveConflict } from "./types/SaveConflict.ts";
import type { StateRequest } from "./types/StateRequest.ts";

const RUNS = 3;

/**
 * Server saves outside a request (k.persist), for runners and jobs: restore `factory`'s stores from one `read`, run
 * `fn(S)`, and on its `ok` save them in one `commit` as an action does, reporting `save` events. A refused commit runs
 * `fn` again on a fresh read, at most 3 runs in all, then resolves `keel.conflict`; `err` or a throw saves nothing.
 * Resolves `fn`'s `Result` once saved.
 */
export async function commitStores<S, T, E extends KeelError<string, unknown>>(
  ctx: Ctx,
  factory: (ctx: Ctx) => S,
  fn: (stores: S) => Result<T, E> | Promise<Result<T, E>>,
): Promise<Result<T, E | SaveConflict>> {
  for (let run = 1; ; run++) {
    const sc = scope(() => undefined, { detached: true });
    isolate(sc);
    const rq: StateRequest = { scope: sc, held: new Map() };
    try {
      const out = await fn((await openHeld(ctx, rq, factory)).value);
      if (!out.ok) return out;
      const clash = await saveStores(ctx, rq);
      if (clash === null) return out;
      if (run === RUNS) return err(clash);
    } finally {
      sc.dispose();
    }
  }
}
