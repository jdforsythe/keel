import type { OutRecord } from "../types/OutRecord.ts";
import { summary } from "./summary.ts";

/**
 * `keel test` in-process: the engine runs no tests itself (`@keel/testing` is later in the deps order); the
 * binary delegates to the vitest harness. In-process it reports the empty run.
 */
export function testCommand(): OutRecord[] {
  return [summary("test", [], { tests: 0, failed: 0, skipped: 0 })];
}
