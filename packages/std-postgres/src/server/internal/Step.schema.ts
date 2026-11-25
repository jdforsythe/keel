import { s } from "@keel/schema";

/**
 * One step of a database's sim plan (std.postgres Modes, k.sim): wait `delay` sim ms, then `none` runs the call,
 * `unavailable` answers `keel.unreachable` and runs nothing, `conflict` is a serialization failure.
 */
export const Step = s.object({
  delay: s.int({ min: 0, max: 60_000 }),
  fault: s.enum(["none", "unavailable", "conflict"]),
});
export type Step = s.infer<typeof Step>;
