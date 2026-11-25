import { s } from "@keel/schema";
import { Resolution } from "../Resolution.schema.ts";

/** `<id>.resolve`. */
export const Resolve = s.object({ key: s.string(), resolution: Resolution });
