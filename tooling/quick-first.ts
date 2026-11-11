// Vitest sequencer for mutation runs. Stryker stops a mutant's run at the first failing test, so the files that
// cost least go first: a mutant a quick test kills never pays for a slow one. Times come from the dry run
// (`KEEL_TEST_TIMES`, written by the `keel` Stryker reporter) and are read at sort time.
import { BaseSequencer, type TestSpecification } from "vitest/node";
import { packageRelative, readTimes } from "./mutate-cache.ts";

/** `files` shortest first by `times`; a file with no recorded time counts as 0; ties by name. */
export function quickFirstOrder<T>(files: readonly T[], name: (f: T) => string, times: Record<string, number>): T[] {
  const cost = (f: T): number => times[name(f)] ?? 0;
  return [...files].sort((a, b) => cost(a) - cost(b) || name(a).localeCompare(name(b)));
}

export class QuickFirst extends BaseSequencer {
  override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    return quickFirstOrder(files, (f) => packageRelative(f.moduleId), readTimes(process.env.KEEL_TEST_TIMES));
  }
}
