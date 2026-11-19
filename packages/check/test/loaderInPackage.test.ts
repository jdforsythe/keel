import { describe, expect, test } from "vitest";
import { type SourceFile, check } from "../src/index.ts";

const f = (path: string, source: string): SourceFile => ({ path, source });
const e1551 = (files: SourceFile[]) =>
  check(files, { types: false })
    .diagnostics.filter((d) => d.code === "E1551")
    .map((d) => d.path);
const RUNNER =
  "import { commitStores } from '@keel/server'\nexport const step = (ctx: never, factory: never) => commitStores(ctx, factory, () => 1)\n";
const LOADER = "import { loader } from '@keel/router'\nexport const load = loader({}, async () => 1)\n";

describe("E1551 scope", () => {
  test("app code outside *.server.ts is E1551", () => {
    expect(e1551([f("modules/a/step.ts", RUNNER), f("modules/a/load.ts", LOADER)])).toEqual([
      "modules/a/load.ts",
      "modules/a/step.ts",
    ]);
  });

  // Files under the root's packages/ are kernel and stdlib code, which E1551 does not read.
  test("kernel and stdlib sources under packages/ are not E1551", () => {
    expect(
      e1551([
        f("packages/std-workflows/src/internal/stepJob.ts", RUNNER),
        f("packages/std-channels/src/channelRoute.ts", LOADER),
      ]),
    ).toEqual([]);
  });
});
