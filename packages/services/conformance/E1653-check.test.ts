import { fixedTime } from "@keel/tooling/test-time";
import { check } from "@keel/check";
import { describe, expect, it } from "vitest";
// No randomness; fixed sources. Checked through the public `check(files, { types: false })`.
const head = `import { endpoints } from '@keel/services'\nimport { s } from '@keel/schema'\n`;
const file = (path: string, method: string) => ({
  path,
  source: `${head}export const OrdersApi = endpoints({\n  act: { method: '${method}', path: '/orders', body: s.object({}), output: s.object({}) },\n})\n`,
});
const getBody = file("modules/a/api.schema.ts", "GET");
const headBody = file("modules/b/api.schema.ts", "HEAD");
const post = file("modules/c/api.schema.ts", "POST");
const put = file("modules/d/api.schema.ts", "PUT");
const getNoBody = {
  path: "modules/e/api.schema.ts",
  source: `${head}export const OrdersApi = endpoints({\n  act: { method: 'GET', path: '/orders', output: s.object({}) },\n})\n`,
};

const hits = async (files: { path: string; source: string }[]): Promise<Set<string>> => {
  const r = await check(files, { types: false });
  return new Set(r.diagnostics.filter((d) => d.code === "E1653").map((d) => d.path));
};

describe("k.services: E1653", () => {
  it(
    "E1653 `body` on a `GET` endpoint is reported",
    async () => {
      expect(await hits([getBody, post, put, getNoBody])).toEqual(new Set([getBody.path]));
    },
    fixedTime(30_000),
  );

  it(
    "E1653 `body` on a `HEAD` endpoint is reported",
    async () => {
      expect(await hits([headBody, post, put, getNoBody])).toEqual(new Set([headBody.path]));
    },
    fixedTime(30_000),
  );

  it(
    "E1653 is not reported for `body` on POST or PUT, nor for GET without a body",
    async () => {
      expect(await hits([post, put, getNoBody])).toEqual(new Set());
    },
    fixedTime(30_000),
  );
});
