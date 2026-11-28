// E1009 skips tests and kernel and stdlib code, as E1551 does; E1571 and E1759 read placement from a nested project's
// own `topology.ts` (k.boundary).
import { describe, expect, it } from "vitest";
import { check } from "../src/check.ts";

const GUARD =
  "import { guard } from '@keel/router'\nexport const auth = guard({ redirect: 'a.home' }, async () => null)\n";
const codes = (files: { path: string; source: string }[], code: string) =>
  check(files, { types: false })
    .diagnostics.filter((d) => d.code === code)
    .map((d) => d.path);

describe("boundary scope", () => {
  it("E1009 is not reported in a test file or under packages/", () => {
    expect(codes([{ path: "modules/a/auth.test.ts", source: GUARD }], "E1009")).toEqual([]);
    expect(codes([{ path: "packages/std-x/src/auth.ts", source: GUARD }], "E1009")).toEqual([]);
  });

  it("a nested app's lib file no route component reaches is not E1571", () => {
    const fetch =
      "import type { Ctx } from '@keel/ctx'\nexport const get = (ctx: Ctx) => ctx.net.fetch(new Request('https://x.example/'))\n";
    const files = [
      {
        path: "apps/x/topology.ts",
        source:
          "import { topology } from '@keel/server'\nexport default topology({ api: { modules: ['a'], adapter: 'node' } })\n",
      },
      { path: "apps/x/lib/net.ts", source: fetch },
      { path: "apps/x/modules/a/net.ts", source: fetch },
    ];
    expect(codes(files, "E1571")).toEqual(["apps/x/modules/a/net.ts"]);
  });
});
