import type { Ctx } from "@keel/ctx";
import type { KeelError, Result } from "@keel/schema";
import type { BoardView } from "./BoardView.schema.ts";
import { refreshView } from "./refreshView.ts";

/** Await one write a component sent to the `api` deployable; when it succeeded, re-read the board (`refreshView`) at the page's origin. */
export async function syncAfter(
  ctx: Ctx,
  write: Promise<Result<unknown, KeelError<string, unknown>>>,
): Promise<Result<BoardView, KeelError<string, unknown>>> {
  const w = await write;
  return w.ok ? refreshView(location.origin, ctx) : w;
}
