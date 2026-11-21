// E1567 reads `service` through a named import, an alias and a namespace import (k.compat).
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";
import type { SourceFile } from "../src/index.ts";

const f = (path: string, source: string): SourceFile => ({ path, source });
const MODULE = (id: string, deps: string): SourceFile =>
  f(
    `modules/${id}/module.ts`,
    `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${deps}, capabilities: [], public: { exports: [] } })\n`,
  );
const project = (apiSource: string): SourceFile[] => [
  MODULE("b", "[]"),
  f(
    "modules/b/b.contract.ts",
    "import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\nexport const b = contract('b', { 'b.pub': { method: 'GET', path: '/b/pub', output: s.json() } })\n",
  ),
  MODULE("a", "['b']"),
  f(
    "modules/a/BApi.schema.ts",
    "import { endpoints } from '@keel/services'\nimport { s } from '@keel/schema'\nexport const BApi = endpoints({ get: { method: 'GET', path: '/b/pub', output: s.json() } })\n",
  ),
  f("modules/a/api.ts", `${apiSource}\nimport { BApi } from './BApi.schema.ts'\ndeclare const origin: string\n`),
];
const e1567 = (api: string): number =>
  check(project(api), { types: false }).diagnostics.filter((d) => d.code === "E1567").length;

describe("E1567 reads how service is imported", () => {
  it("reports a named import, an alias and a namespace import", () => {
    expect(
      e1567("import { service } from '@keel/services'\nexport const api = service({ base: origin, schema: BApi })"),
    ).toBe(1);
    expect(
      e1567("import { service as svc } from '@keel/services'\nexport const api = svc({ base: origin, schema: BApi })"),
    ).toBe(1);
    expect(
      e1567("import * as sv from '@keel/services'\nexport const api = sv.service({ base: origin, schema: BApi })"),
    ).toBe(1);
  });

  it("passes a namespace call with an http base, another member and another package", () => {
    expect(
      e1567(
        "import * as sv from '@keel/services'\nexport const api = sv.service({ base: 'https://x.test', schema: BApi })",
      ),
    ).toBe(0);
    expect(
      e1567("import * as sv from '@keel/services'\nexport const api = sv.other({ base: origin, schema: BApi })"),
    ).toBe(0);
    expect(
      e1567("import * as sv from './other.ts'\nexport const api = sv.service({ base: origin, schema: BApi })"),
    ).toBe(0);
  });

  it("matches the API entry's method: a POST endpoint at a GET entry's path is clean", () => {
    const files = project(
      "import { service } from '@keel/services'\nexport const api = service({ base: origin, schema: BApi })",
    ).map((x) =>
      x.path === "modules/a/BApi.schema.ts" ? { ...x, source: x.source.replace("method: 'GET'", "method: 'POST'") } : x,
    );
    expect(check(files, { types: false }).diagnostics.filter((d) => d.code === "E1567")).toEqual([]);
  });
});
