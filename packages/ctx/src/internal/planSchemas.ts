import type { Schema } from "@keel/schema";
import { extensions } from "./extensions.ts";

/** Each registered capability with a `plan` schema, in registration order: what `simulate` generates plans from. */
export function planSchemas(): [name: string, plan: Schema<unknown, boolean>][] {
  return [...extensions].flatMap(([name, r]) => (r.plan === undefined ? [] : [[name, r.plan]]));
}
