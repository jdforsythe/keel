import { s } from "@keel/schema";
import { Runs } from "./Runs.schema.ts";

/** This page's copy of the weekly runs; `read` is false until the first read since the page opened commits. */
export const RunsCopy = s.object({ runs: Runs, read: s.boolean() });
