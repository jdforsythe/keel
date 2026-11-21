import type { Ctx } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
import { scope, signal } from "@keel/reactive";
import type { Signal } from "@keel/reactive";
import type { CaughtError } from "../types/CaughtError.ts";
import type { Catcher } from "./Catcher.ts";
import { rootFallback } from "./rootFallback.ts";
import { toCaught } from "./toCaught.ts";

/**
 * The default root Boundary of a resumed island (k.errors), the same one `mount` puts around its tree: the first
 * throw under it becomes `keel.unexpected` with `data.at`, is reported to the ctx, and `settle` swaps the island for
 * the root fallback (its text by `mode`). Until `arm()` (the island's claim succeeded) a throw passes through as if there were no
 * Boundary, so a claim that throws is a mismatch, not an error.
 */
export function rootCatcher(
  ctx: Ctx | undefined,
  mode: "dev" | "production" | undefined,
  settle: (fallback: Node) => void,
): Catcher & { arm(): void } {
  const made: Signal<{ readonly error: CaughtError | null }>[] = [];
  // Its own detached scope: the island outlives whatever scope `resume` runs in, and the state goes once it fails.
  const home = scope(() => void made.push(signal<{ readonly error: CaughtError | null }>({ error: null })), {
    detached: true,
  });
  const [state] = made;
  if (state === undefined) throw new Error("k.runtime: root catcher state");
  let armed = false;
  let failed: CaughtError | null = null;
  return {
    state,
    arm: () => {
      armed = true;
    },
    fail(error, at) {
      if (!armed) throw error;
      if (failed !== null) return;
      failed = toCaught(error, at);
      report(ctx, { kind: "error", error: failed });
      settle(rootFallback(failed, mode));
      state.set({ error: failed });
      home.dispose();
    },
  };
}
