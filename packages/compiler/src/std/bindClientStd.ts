import type { Ctx } from "@keel/ctx";
import { s } from "@keel/schema";
import { bindStd } from "./bindStd.ts";

const State = s.object({ std: s.record(s.record(s.json())) });

/**
 * Bind the std config an island document carries to the browser's `ctx` (k.module Std config, rfc:0069): `text` is
 * the `#k-state` JSON, whose `std` is the `std.json` data `createApp({ std })` bound on the server. The generated
 * resume entry calls it before `resume`, so `stdConfig` in an island reads what the server read. Absent, unparsable
 * or misshapen `std` binds nothing (`stdConfig` gives `{}`); a value failing its package's registered schema throws
 * E1158, as `bindStd` does.
 */
export function bindClientStd(ctx: Ctx, text: string | null | undefined): void {
  let raw: unknown;
  try {
    raw = JSON.parse(text ?? "");
  } catch {
    return;
  }
  const r = State.parse(raw);
  if (r.ok) bindStd(ctx, r.value.std);
}
