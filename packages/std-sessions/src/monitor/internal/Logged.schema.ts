import { s } from "@keel/schema";

/** The part of a stored server snapshot (`keel.store.<id>`) `monitor` reads: each log entry's `id` and `name`. */
export const Logged = s.object({ log: s.array(s.object({ id: s.int(), name: s.string() })) });
export type Logged = s.infer<typeof Logged>;
