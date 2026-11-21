import type { Ctx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { isolate } from "../isolate.ts";
import { openStores } from "./openStores.ts";
import { saveStores } from "./saveStores.ts";
import type { ServerState } from "./types/ServerState.ts";
import type { StateRequest } from "./types/StateRequest.ts";

/**
 * Server state over `ctx` (k.server Server state), the runner a `node` deployable uses: each `request()` opens a
 * detached root scope with its own store registry (k.store `isolate`); its `stores(factory)` is `openStores` on it,
 * `save()` is `saveStores`, and `end()` disposes the scope and every instance opened in it. Requests over one
 * `ctx.storage` share its copy (`copyOf`).
 */
export function serverState(ctx: Ctx): ServerState {
  return {
    request() {
      const sc = scope(() => undefined, { detached: true });
      isolate(sc);
      const rq: StateRequest = { scope: sc, held: new Map() };
      return {
        stores: (factory) => openStores(ctx, rq, factory),
        save: () => saveStores(ctx, rq),
        end: () => sc.dispose(),
      };
    },
  };
}
