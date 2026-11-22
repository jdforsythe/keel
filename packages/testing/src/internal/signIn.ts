import type { Ctx } from "@keel/ctx";
import { fail } from "./fail.ts";

/** The key `@keel/services` reads a ctx's default user from (its `USERS_KEY`); neither package imports the other. */
const USERS_KEY = Symbol.for("keel.users");
/** Open harnesses per ctx that hold its default user. */
const open = new WeakMap<Ctx, number>();

/** The table under `USERS_KEY`, made on first use. */
function users(): WeakMap<Ctx, string> {
  const found: unknown = Reflect.get(globalThis, USERS_KEY);
  if (found instanceof WeakMap) return found;
  const made = new WeakMap<Ctx, string>();
  Reflect.set(globalThis, USERS_KEY, made);
  return made;
}

/**
 * Sign `ctx` in as `user` while a router-mode harness is open (k.user Testing): a `service({ contract })` call on it
 * that names no `user` carries `user`. A second open harness with another user rejects E1724, since one ctx cannot
 * tell its pages apart. Returns the sign-out the harness's `dispose` runs; the last one clears the user.
 */
export function signIn(ctx: Ctx, id: string, user: string): () => void {
  const table = users();
  const held = table.get(ctx);
  if (held !== undefined && held !== user)
    throw fail(
      "E1724",
      `renderRoute(${JSON.stringify(id)}): ctx has an open harness with another user; pass app for two users`,
      { user },
    );
  table.set(ctx, user);
  open.set(ctx, (open.get(ctx) ?? 0) + 1);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    const left = (open.get(ctx) ?? 1) - 1;
    open.set(ctx, left);
    if (left === 0) table.delete(ctx);
  };
}
