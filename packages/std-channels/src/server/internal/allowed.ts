import { type Ctx, supervise } from "@keel/ctx";
import { Rejected } from "../../internal/Rejected.schema.ts";
/**
 * `member` applied, failing closed: supervised as `channels.member` (k.supervise), so a throw of any value, a defect
 * among them, is reported once and is a denial.
 */
export function allowed<A>(ctx: Ctx, member: (at: A) => boolean, at: A): boolean {
  const asked = supervise(ctx, "channels.member", () => member(at) === true, Rejected.make({}));
  return asked.ok && asked.value;
}
