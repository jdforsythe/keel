import type { Owner } from "./Owner.ts";
import { cx } from "./cx.ts";

/** The owner of the render in progress; ops are only valid inside `mount`, `resume`, or a structural op. */
export function current(op: string): Owner {
  const o = cx.owner;
  if (o === null) throw new Error(`k.runtime: ${op}() called outside a mount or resume render`);
  return o;
}
