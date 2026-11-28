import { s } from "@keel/schema";
import { NetStep } from "./NetStep.schema.ts";

/**
 * What a sim ctx's seed leaves alone (k.sim): the n-th fetch takes `net[n]`, the n-th storage call `storage[n]`
 * (past the end: no delay, no fault), each offline window takes the net offline from `at` to `at + ms` of clock time,
 * and `plans[name]` drives the registered capability `name`. JSON.
 */
export const Schedule = s.object({
  net: s.array(NetStep),
  storage: s.array(s.enum(["ok", "fail"])),
  offline: s.array(s.object({ at: s.number({ min: 0 }), ms: s.number({ min: 0 }) })),
  plans: s.record(s.array(s.json())),
});
export type Schedule = s.infer<typeof Schedule>;
