import { type Ctx, seedOf } from "@keel/ctx";
import type { Session } from "../Session.schema.ts";
import { session } from "../session.ts";
import type { Live } from "./Live.ts";
import { actives } from "./actives.ts";
import { emptySession } from "./emptySession.ts";

/** The recorder without a `document` (a server render, D5): it observes nothing and never puts. */
export function inert(ctx: Ctx): Live {
  let done: Session | undefined;
  const now = (): Session => emptySession(session(ctx).id(), seedOf(ctx), ctx.clock.now());
  const live: Live = {
    recorder: {
      events: () => [],
      errors: () => [],
      stop() {
        if (actives.get(ctx) === live) actives.delete(ctx);
        done ??= now();
        return done;
      },
    },
    peek: () => null,
    note: () => {},
  };
  return live;
}
