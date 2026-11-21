// Spec: k.a11y, Conformance "After `keel test` with one passing `renderRoute` test of route `r`, `keel ledger` gives `a11y:r#1.4.3` rung `example` and `a11y:r2#1.4.3` rung `none` for an untested route `r2`; a violation of a rule mapped to 1.4.3 on `r` makes it `none`."
// Seed: 1337 (no property in this file: fixed projects, one binary run per step).
// The real `keel` binary over temp projects (OS tmpdir). Assumed: route ids carry the module prefix (`m.r`, `m.r2`),
// `keel build` (node-only topology) writes `.keel/routes.json`, and tokens reach `renderRoute` as `artifacts: { tokens }`.
import { existsSync, readFileSync, readdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliRecord, type Run, keel, makeProject, removeProject, root } from "./test-sim-project.ts";

const ITEM_R = "a11y:m.r#1.4.3";
const ITEM_R2 = "a11y:m.r2#1.4.3";

const CONTRACT = `import { contract } from "@keel/router/contract";
export const m = contract("m", {
  "m.r": { path: "/r" },
  "m.r2": { path: "/r2" },
});
`;
const ROUTES = `import { manifest } from "@keel/router";
import { Text } from "@keel/ui";
import { m } from "./m.contract.ts";

export const routes = manifest(m, {
  "m.r": { component: () => Text({ id: "m.r.msg", fg: "fg", children: "r" }), title: () => "R" },
  "m.r2": { component: () => Text({ id: "m.r2.msg", fg: "fg", children: "r2" }), title: () => "R2" },
});
`;
const tokens = (fg: string): string =>
  `import { defineTokens } from "@keel/ui";\nexport const tokens = defineTokens({ color: { fg: "${fg}", bg: "#ffffff" } });\n`;
const TOPOLOGY = `export default { api: { modules: ["m"], adapter: "node" } };\n`;

// The fixture test's environment line is joined from two parts so vitest does not read it as this file's own.
const ENV = ["// @vitest", "environment happy-dom"].join("-");
const PASSING = `${ENV}
import { createCtx } from "@keel/ctx";
import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import { tokens } from "../../../tokens.ts";
import { routes } from "../routes.ts";

it("renders the route r", async () => {
  const h = await renderRoute("m.r", { routes, ctx: createCtx({ mode: "sim", seed: 1337 }), artifacts: { tokens } });
  expect(h.find("m.r.msg").text).toBe("r");
  h.dispose();
});
`;
// the same test, but the route's text is below 4.5:1 and the test expects the E1804 refusal, so it passes
const VIOLATING = PASSING.replace(
  `const h = await renderRoute("m.r", { routes, ctx: createCtx({ mode: "sim", seed: 1337 }), artifacts: { tokens } });
  expect(h.find("m.r.msg").text).toBe("r");
  h.dispose();`,
  `await expect(
    renderRoute("m.r", { routes, ctx: createCtx({ mode: "sim", seed: 1337 }), artifacts: { tokens } }),
  ).rejects.toMatchObject({ code: "E1804" });`,
);

const created: string[] = [];
const project = (prefix: string, fg: string, test: string): string => {
  const dir = makeProject(prefix, {
    "tokens.ts": tokens(fg),
    "topology.ts": TOPOLOGY,
    "modules/m/m.contract.ts": CONTRACT,
    "modules/m/routes.ts": ROUTES,
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
  passing = ledgerAfterTest(project("a11y-ledger-pass", "#111111", PASSING));
  violatingDir = project("a11y-ledger-bad", "#8a8a8a", VIOLATING);
  violating = ledgerAfterTest(violatingDir);
}, 240_000);
afterAll(() => {
  for (const d of created) removeProject(d);
});

describe("k.a11y: ledger claims from reports/a11y.json", () => {
  it("After `keel test` with one passing `renderRoute` test of route `r`, `keel ledger` gives `a11y:r#1.4.3` rung `example`", () => {
    expect(claim(passing, ITEM_R)).toMatchObject({ kind: "ledger", item: ITEM_R, rung: "example" });
  });

  it("`a11y:r2#1.4.3` is rung `none` for an untested route `r2`", () => {
    expect(claim(passing, ITEM_R2)).toMatchObject({ kind: "ledger", item: ITEM_R2, rung: "none" });
  });

  it("a violation of a rule mapped to 1.4.3 on `r` makes it `none`", () => {
    expect(claim(violating, ITEM_R)).toMatchObject({ item: ITEM_R, rung: "none" });
  });

  it("`keel test` writes every render check to `reports/a11y.json` as `A11yRun[]` with route, rules run and violations", () => {
    const text = readFileSync(join(violatingDir, "reports", "a11y.json"), "utf8");
    const runs: unknown = JSON.parse(text);
    expect(Array.isArray(runs)).toBe(true);
    expect(text).toContain("m.r");
    expect(text).toContain("E1804");
  });

  it("every claim is `{ kind: 'ledger', item, rung, evidence }`", () => {
    const rec = claim(passing, ITEM_R);
    expect(Object.keys(rec ?? {}).sort()).toEqual(["evidence", "item", "kind", "rung"]);
  });
});
