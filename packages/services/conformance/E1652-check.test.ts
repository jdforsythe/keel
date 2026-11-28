import { fixedTime } from "@keel/tooling/test-time";
import { check } from "@keel/check";
import { describe, expect, it } from "vitest";
// No randomness; fixed sources. Checked through the public `check(files, { types: false })`.
const head = `import { endpoints } from '@keel/services'\nimport { s } from '@keel/schema'\n`;
const file = (path: string, endpoint: string) => ({
  path,
  source: `${head}export const OrdersApi = endpoints({\n  getOrder: ${endpoint},\n})\n`,
});
const missingField = file(
  "modules/a/api.schema.ts",
  "{ method: 'GET', path: '/orders/:id', params: s.object({}), output: s.object({}) }",
);
const otherField = file(
  "modules/b/api.schema.ts",
  "{ method: 'GET', path: '/orders/:id', params: s.object({ other: s.string() }), output: s.object({}) }",
);
const extraField = file(
  "modules/c/api.schema.ts",
  "{ method: 'GET', path: '/orders', params: s.object({ extra: s.string() }), output: s.object({}) }",
);
const extraBeside = file(
  "modules/d/api.schema.ts",
  "{ method: 'GET', path: '/orders/:id', params: s.object({ id: s.string(), extra: s.string() }), output: s.object({}) }",
);
const clean = [
  file(
    "modules/e/api.schema.ts",
    "{ method: 'GET', path: '/orders/:id', params: s.object({ id: s.string() }), output: s.object({}) }",
  ),
  file("modules/f/api.schema.ts", "{ method: 'GET', path: '/orders', output: s.object({}) }"),
  file(
    "modules/g/api.schema.ts",
    "{ method: 'GET', path: '/orders/:id/notes/:noteId', params: s.object({ id: s.string(), noteId: s.int() }), output: s.object({}) }",
  ),
];

const hits = async (files: { path: string; source: string }[]): Promise<Set<string>> => {
  const r = await check(files, { types: false });
  return new Set(r.diagnostics.filter((d) => d.code === "E1652").map((d) => d.path));
};

describe("k.services: E1652", () => {
  it(
    "E1652 a `:param` in a literal `path` without a field in a literal `params` is reported",
    async () => {
      expect(await hits([missingField, otherField, ...clean])).toEqual(new Set([missingField.path, otherField.path]));
    },
    fixedTime(30_000),
  );

  it(
    "E1652 a `params` field missing from the `path` is reported",
    async () => {
      expect(await hits([extraField, extraBeside, ...clean])).toEqual(new Set([extraField.path, extraBeside.path]));
    },
    fixedTime(30_000),
  );

  it(
    "E1652 is not reported when every `:param` has a field and every field has a `:param`",
    async () => {
      expect(await hits(clean)).toEqual(new Set());
    },
    fixedTime(30_000),
  );
});
