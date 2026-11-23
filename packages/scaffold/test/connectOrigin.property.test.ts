// k.scaffold Service: the `origins.connect` edit of `topology.ts`. Whatever the deployable's layout and quote style,
// the static read (k.origins) finds exactly the declared entry afterwards, and every other property is kept.
import { declaredOrigins } from "@keel/compiler/hosting/declaredOrigins";
import fc from "fast-check";
import { expect, it } from "vitest";
import { connectOrigin } from "../src/internal/connectOrigin.ts";
import { topologyAst } from "../src/internal/topologyAst.ts";
import { RUNS, SEED } from "./helpers.ts";

const host = fc.stringMatching(/^[a-z]{3,9}$/).map((h) => `https://${h}.example.com`);
const reason = fc.stringMatching(/^[a-z][a-z ']{0,40}[a-z]$/);
const layouts = (q: string): string[] => [
  `export default topology({\n  web: { modules: [${q}app${q}], adapter: ${q}client${q} },\n});\n`,
  `export default topology({\n  web: {\n    modules: [${q}app${q}],\n    adapter: ${q}client${q},\n  },\n});\n`,
  `export default topology({ web: { modules: [${q}app${q}], adapter: ${q}client${q}, origins: {} } });\n`,
  `export default topology({\n  web: { modules: [${q}app${q}], adapter: ${q}client${q}, origins: { img: { ${q}https://cdn.example.com${q}: ${q}photos${q} } } },\n});\n`,
  `export default topology({\n  web: {\n    modules: [${q}app${q}],\n    adapter: ${q}client${q},\n    origins: {\n      connect: {\n        ${q}https://first.example.com${q}: ${q}first${q},\n      },\n    },\n  },\n});\n`,
];

it("declares the entry under connect in every layout and quote style, keeping what was there", () => {
  fc.assert(
    fc.property(host, reason, fc.constantFrom("'", '"'), fc.integer({ min: 0, max: 4 }), (origin, why, q, i) => {
      const src = layouts(q)[i] ?? "";
      const before = declaredOrigins(src);
      const next = connectOrigin(src, "web", origin, why);
      expect(next).not.toBeNull();
      const after = declaredOrigins(next ?? "");
      expect(after.problems).toEqual([]);
      expect(after.origins.web?.connect).toEqual({ ...before.origins.web?.connect, [origin]: why });
      expect(after.origins.web?.img).toEqual(before.origins.web?.img);
      const d = topologyAst(next ?? "")?.deployables[0];
      expect([d?.name, d?.adapter, d?.modules]).toEqual(["web", "client", ["app"]]);
      expect(q === "'" ? next : "").not.toContain('"');
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

it("a one-line deployable taken past 120 columns is written one property per line", () => {
  const src = `export default topology({\n  web: { modules: ["app"], adapter: "client", styles: ["@keel/ui/fonts"] },\n});\n`;
  expect(connectOrigin(src, "web", "https://api.github.com", "the release list on the releases page")).toBe(
    [
      "export default topology({",
      "  web: {",
      `    modules: ["app"],`,
      `    adapter: "client",`,
      `    styles: ["@keel/ui/fonts"],`,
      `    origins: { connect: { "https://api.github.com": "the release list on the releases page" } },`,
      "  },",
      "});",
      "",
    ].join("\n"),
  );
});

it("is null for an unknown deployable and for origins that is not an object literal", () => {
  const src = `export default topology({ web: { modules: ["app"], adapter: "client", origins: shared } });\n`;
  expect(connectOrigin(src, "api", "https://a.example.com", "x")).toBeNull();
  expect(connectOrigin(src, "web", "https://a.example.com", "x")).toBeNull();
});
