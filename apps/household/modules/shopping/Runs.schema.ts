import { s } from "@keel/schema";
import { Run } from "./Run.schema.ts";

/** The latest weekly run, `null` before the first; how many runs the store holds. */
export const Runs = s.object({ last: Run.nullable(), kept: s.int({ min: 0 }) });
