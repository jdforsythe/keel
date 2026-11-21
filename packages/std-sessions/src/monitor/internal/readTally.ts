import type { Ctx } from "@keel/ctx";
import { Tally } from "../Tally.schema.ts";
import { TALLY_KEY } from "./TALLY_KEY.ts";

/** The `Tally` stored under `sessions.tally`; undefined when none is stored or the value is not a `Tally`. */
export async function readTally(ctx: Ctx): Promise<Tally | undefined> {
  const raw = await ctx.storage.get(TALLY_KEY);
  if (raw === null) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const parsed = Tally.parse(value);
  return parsed.ok ? parsed.value : undefined;
}
