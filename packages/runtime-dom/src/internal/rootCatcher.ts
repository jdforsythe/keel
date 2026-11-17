import type { Ctx } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
import { scope, signal } from "@keel/reactive";
import type { Signal } from "@keel/reactive";
import type { UnexpectedError } from "../types/UnexpectedError.ts";
import type { Catcher } from "./Catcher.ts";
import { rootFallback } from "./rootFallback.ts";
import { toUnexpected } from "./toUnexpected.ts";

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
  const made: Signal<{ readonly error: UnexpectedError | null }>[] = [];
  // Its own detached scope: the island outlives whatever scope `resume` runs in, and the state goes once it fails.
  const home = scope(() => void made.push(signal<{ readonly error: UnexpectedError | null }>({ error: null })), {
    detached: true,
  });
  const [state] = made;
  if (state === undefined) throw new Error("k.runtime: root catcher state");
  let armed = false;
  let failed: UnexpectedError | null = null;
  return {
    state,
    arm: () => {
      armed = true;
    },
    fail(error, at) {
      if (!armed) throw error;
      if (failed !== null) return;
      failed = toUnexpected(error, at);
      report(ctx, { kind: "error", error: failed });
      settle(rootFallback(failed, mode));
      state.set({ error: failed });
      home.dispose();
    },
  };
}
