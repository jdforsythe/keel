import type { Ctx } from "@keel/ctx";
import type { KeelError, Result, Secret } from "@keel/schema";
import type { ApiGuard } from "../types/ApiGuard.ts";
import { owned } from "./owned.ts";

/** Run a guard for `url` as `who` (its `caller` and `user`) with `bearer` (k.api Bearer; absent off an API route); a throw becomes `keel.unexpected` (anything but `keel.denied` is not a denial). */
export async function runGuard(
  g: ApiGuard,
  url: string,
  ctx: Ctx,
  who: { readonly caller: string; readonly user: string },
  bearer?: Secret<string>,
): Promise<Result<null, KeelError<string, unknown>>> {
  return owned(() => g.run(bearer === undefined ? { url, ...who } : { url, ...who, bearer }, ctx));
}
