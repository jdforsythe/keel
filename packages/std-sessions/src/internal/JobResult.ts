import { s } from "@keel/schema";
import { Session } from "../Session.schema.ts";

/** One `nav` input's route match, so an emitted test writes `routes.href(id, params, search)`. */
const NavCall = s.object({ index: s.int(), id: s.string(), params: s.record(s.json()), search: s.record(s.json()) });

/**
 * What a `keel session` job writes back (rfc:0070 §8 Job file): the replay's `fingerprint`, first error `code`,
 * `unapplied` index and whether it `reproduced`; `session` is the minimized (`minimize`) or redacted (`to-test`)
 * session when the op reproduced, with `navs` (`to-test`). `runs` and `minimal` report `minimize`.
 */
export const JobResult = s.object({
  reproduced: s.boolean(),
  fingerprint: s.string(),
  error: s.string().nullable(),
  unapplied: s.int().nullable(),
  session: Session.nullable(),
  navs: s.array(NavCall),
  runs: s.int(),
  minimal: s.boolean(),
});
export type JobResult = s.infer<typeof JobResult>;
