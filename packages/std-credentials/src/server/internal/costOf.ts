import { stdConfig } from "@keel/compiler/std/stdConfig";
import type { Ctx } from "@keel/ctx";
import { CredentialsConfig } from "../../CredentialsConfig.ts";

/** A ctx's cost: the highest `ln` any module's `std` config sets, 17 when none does. */
export function costOf(ctx: Ctx): number {
  const set = Object.values(stdConfig(ctx, "@keel/std-credentials", CredentialsConfig)).map((c) => c.ln ?? 17);
  return Math.max(17, ...set);
}
