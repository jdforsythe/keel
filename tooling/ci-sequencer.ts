// vitest's sequencer for a package CI splits into parts (SPLIT in ci-plan.ts): `--shard=i/k` runs the files
// `splitFiles` deals to part i of k by their recorded seconds (ci-shards.json), the parts tooling/ci-shards.mjs plans,
// instead of vitest's equal counts of files by path hash. A run's files start slowest first, so the slowest file does
// not start last. A package with no recorded files keeps vitest's own split and order.
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { BaseSequencer, type TestSpecification } from "vitest/node";
import { readTimes, splitFiles } from "./ci-plan.ts";

/** The package name in `root`'s package.json, or undefined. */
function packageName(root: string): string | undefined {
  const pkg: unknown = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  if (typeof pkg !== "object" || pkg === null || !("name" in pkg)) return undefined;
  return typeof pkg.name === "string" ? pkg.name : undefined;
}

export class TimedSequencer extends BaseSequencer {
  /** The recorded seconds of this package's files, or undefined when none are recorded. */
  private seconds(): Record<string, number> | undefined {
    const name = packageName(this.ctx.config.root);
    return name === undefined ? undefined : readTimes().files[name];
  }

  private rel(spec: TestSpecification): string {
    return relative(this.ctx.config.root, spec.moduleId).split("\\").join("/");
  }

  override async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const seconds = this.seconds();
    if (seconds === undefined) return super.shard(files);
    const { index, count } = this.ctx.config.shard ?? { index: 1, count: 1 };
    const mine = new Set(
      splitFiles(
        files.map((f) => this.rel(f)),
        seconds,
        count,
      )[index - 1] ?? [],
    );
    return files.filter((f) => mine.has(this.rel(f)));
  }

  override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const seconds = this.seconds();
    if (seconds === undefined) return super.sort(files);
    const w = (f: TestSpecification): number => seconds[this.rel(f)] ?? Number.POSITIVE_INFINITY;
    return [...files].sort((a, b) => w(b) - w(a) || (this.rel(a) < this.rel(b) ? -1 : 1));
  }
}
