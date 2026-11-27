import { fixedTime } from "@keel/tooling/test-time";
import { check } from "@keel/check";
import { describe, expect, it } from "vitest";
// No randomness; fixed sources. Checked through the public `check(files, { types: false })`.
const bad = [
  {
    path: "modules/orders/load.ts",
    source: `export async function load(ctx) {\n  const r = await ctx.net.fetch("https://api.example.com/orders");\n  return r.json();\n}\n`,
  },
  {
    path: "modules/orders/save.ts",
    source: `export const save = async (ctx, body) => ctx.net.fetch("https://api.example.com/orders", { method: "POST", body });\n`,
  },
];
const clean = [
  {
    path: "modules/orders/get.ts",
    source: `import { api } from "./api.ts";\nexport async function get(ctx, id) {\n  return api.getOrder({ params: { id } }, ctx);\n}\n`,
  },
];

describe("k.services: E1651", () => {
  it(
    "E1651 `ctx.net.fetch` in app code is reported for each file that calls it, and for no clean file",
    async () => {
      const r = await check([...bad, ...clean], { types: false });
      const hit = r.diagnostics.filter((d) => d.code === "E1651").map((d) => d.path);
      expect(new Set(hit)).toEqual(new Set(bad.map((f) => f.path)));
    },
    fixedTime(30_000),
  );

  it(
    "E1651 is not reported for code that goes through a declared endpoint",
    async () => {
      const r = await check(clean, { types: false });
      expect(r.diagnostics.filter((d) => d.code === "E1651")).toEqual([]);
    },
    fixedTime(30_000),
  );
});
