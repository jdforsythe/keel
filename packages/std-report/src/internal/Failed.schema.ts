import { s } from "@keel/schema";

/** A request of `keel report` failed (std.report): the fetch threw, or its body is no JSON. */
export const Failed = s.error("report.failed", s.object({ step: s.enum(["fetch", "json"]) }));
