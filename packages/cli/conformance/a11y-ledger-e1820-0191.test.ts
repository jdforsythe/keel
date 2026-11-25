// Spec: k.a11y, Conformance "A `renderRoute` page with tokens whose `Box` takes a computed `direction` `row-reverse` over two `Button`s fails with E1820 naming the `Box`'s id; over one `Button`, or with `row`, it passes, and after `keel test` with that passing run `keel ledger` gives the route's `#2.4.3` and `#1.3.2` rung `example`."
// Seed: 1337 (no property in this file: fixed projects, one binary run per step). The render half is packages/testing/conformance/a11y-e1820-render.test.ts.
// The real `keel` binary over temp projects, as a11y-ledger-claims.test.ts. Assumed: route ids carry the module prefix (`m.r`), `keel build` (node-only topology) writes `.keel/routes.json`, tokens reach `renderRoute` as `artifacts: { tokens }`, the `direction` is computed at run time so `keel check` reports no E1820.
// Non-vacuity: the same route whose test expects the E1820 refusal (a violation of a rule mapped to the criteria) is rung `none`.
import { existsSync, readFileSync, readdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliRecord, type Run, keel, makeProject, removeProject, root } from "./test-sim-project.ts";

const CONTRACT = `import { contract } from "@keel/router/contract";
export const m = contract("m", { "m.r": { path: "/r" } });
`;
const ROUTES = `import { manifest } from "@keel/router";
import { Box, Button } from "@keel/ui";
import { m } from "./m.contract.ts";

// the direction arrives at run time: no static check reads it
export const routes = manifest(m, {
  "m.r": {
    component: () => Box({ id: "m.r.box", direction: ["row", "-reverse"].slice(0, __KEEL_N__).join("") === "row-reverse" ? "row-reverse" : "row", children: () => [Button({ id: "m.r.a", children: "A" }), Button({ id: "m.r.b", children: "B" })] }),
    title: () => "R",
  },
});
`;
const TOKENS = `import { defineTokens } from "@keel/ui";\nexport const tokens = defineTokens({ color: { fg: "#111111", bg: "#ffffff" } });\n`;
const TOPOLOGY = `export default { api: { modules: ["m"], adapter: "node" } };\n`;

const ENV = ["// @vitest", "environment happy-dom"].join("-");
const HEAD = `${ENV}
import { createCtx } from "@keel/ctx";
import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import { tokens } from "../../../tokens.ts";
import { routes } from "../routes.ts";
const ctx = () => createCtx({ mode: "sim", seed: 1337 });
`;
const PASSING = `${HEAD}
it("renders the route r", async () => {
  const h = await renderRoute("m.r", { routes, ctx: ctx(), artifacts: { tokens } });
  expect(h.find("m.r.a").text).toBe("A");
  h.dispose();
});
`;
const VIOLATING = `${HEAD}
it("refuses the reversed route r", async () => {
  await expect(renderRoute("m.r", { routes, ctx: ctx(), artifacts: { tokens } })).rejects.toMatchObject({ code: "E1820" });
});
`;

const created: string[] = [];
// `n` 2 makes the direction `row-reverse`, 1 makes it `row`
const project = (prefix: string, n: 1 | 2, test: string): string => {
  const dir = makeProject(prefix, {
    "tokens.ts": TOKENS,
    "topology.ts": TOPOLOGY,
    "modules/m/m.contract.ts": CONTRACT,
    "modules/m/routes.ts": ROUTES.replace("__KEEL_N__", String(n)),
    "modules/m/test/r.test.ts": test,
  });
  for (const pkg of readdirSync(join(root, "packages"))) {
    const at = join(dir, "node_modules", "@keel", pkg);
    if (!existsSync(at)) symlinkSync(join(root, "packages", pkg), at);
  }
  created.push(dir);
  return dir;
};
const claim = (run: Run, item: string): CliRecord | undefined =>
  run.records.find((r) => r.kind === "ledger" && r.item === item);
const ledgerAfterTest = (dir: string): Run => {
  expect(keel(dir, ["build"]).status).toBe(0);
  expect(keel(dir, ["test"]).status).toBe(0);
  return keel(dir, ["ledger"]);
};

let passing: Run;
let violating: Run;
let violatingDir = "";
beforeAll(() => {
  passing = ledgerAfterTest(project("a11y-e1820-pass", 1, PASSING));
  violatingDir = project("a11y-e1820-bad", 2, VIOLATING);
  violating = ledgerAfterTest(violatingDir);
}, 240_000);
afterAll(() => {
  for (const d of created) removeProject(d);
});

describe("k.a11y: ledger claims for E1820 (#2.4.3, #1.3.2)", () => {
  for (const criterion of ["2.4.3", "1.3.2"]) {
    it(`after \`keel test\` with a passing \`renderRoute\` of a route with \`direction\` \`row\` over two \`Button\`s, \`keel ledger\` gives the route's \`#${criterion}\` rung \`example\``, () => {
      expect(claim(passing, `a11y:.:m.r#${criterion}`)).toMatchObject({ rung: "example" });
    });

    it(`a render that fails with E1820 makes the route's \`#${criterion}\` rung \`none\``, () => {
      expect(claim(violating, `a11y:.:m.r#${criterion}`)).toMatchObject({ rung: "none" });
    });
  }

  it("`reports/a11y.json` records E1820 among the rules run", () => {
    expect(readFileSync(join(violatingDir, "reports", "a11y.json"), "utf8")).toContain("E1820");
  });
});
