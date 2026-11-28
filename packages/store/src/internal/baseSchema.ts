import { s } from "@keel/schema";

/** Codec for a write's `base`: the head its writer last read. */
export const baseSchema = s.int({ min: 0 });
