import type { Ctx } from "@keel/ctx";
import { type KeelError, type Result, attempt } from "@keel/schema";
import type { Guard } from "../types/Guard.ts";

/** Run a guard for `url` as `caller`; a throw becomes `keel.unexpected` (anything but `keel.denied` is not a denial). */
export async function runGuard(
  g: Guard,
  url: string,
  ctx: Ctx,
  caller: string,
): Promise<Result<null, KeelError<string, unknown>>> {
  const r = await attempt(() => g.run({ url, caller }, ctx));
  return r.ok ? r.value : r;
}
