// E1551 (k.persist Rules): `commitStores` from `@keel/server` outside `*.server.ts`, as `loader` and `action`.
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";

const out = (source: string, path = "modules/a/jobs.ts"): string[] =>
  check([{ path, source }], { types: false })
    .diagnostics.filter((d) => d.code === "E1551")
    .map((d) => `${d.line}:${d.col} ${d.message}`);

const CALL = "import { commitStores } from '@keel/server'\nexport const run = (ctx) => commitStores(ctx, f, g)\n";

describe("E1551 commitStores outside a server file", () => {
  it("reports the call, renamed imports included", () => {
    expect(out(CALL)).toEqual(["2:29 commitStores outside a *.server.ts file; move it to <name>.server.ts"]);
    expect(out("import { commitStores as cs } from '@keel/server'\nexport const r = () => cs(c, f, g)\n")).toEqual([
      "2:24 commitStores outside a *.server.ts file; move it to <name>.server.ts",
    ]);
  });

  it("allows it in a *.server.ts file and ignores a same-named local or another package's export", () => {
    expect(out(CALL, "modules/a/jobs.server.ts")).toEqual([]);
    expect(out("const commitStores = (a) => a\nexport const r = commitStores(1)\n")).toEqual([]);
    expect(out("import { commitStores } from './local'\nexport const r = commitStores(1)\n")).toEqual([]);
  });
});
