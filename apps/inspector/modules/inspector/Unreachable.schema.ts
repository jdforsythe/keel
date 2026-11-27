import { s } from "@keel/schema";

/** `inspector.unreachable`: the target did not answer, or its answer was not an inspect document; `url` is the target. */
export const Unreachable = s.error("inspector.unreachable", s.object({ url: s.string() }));
