// Seed 1337. std.jobs E2503 through a namespace import of `@keel/schema`: `ns.s.secret(...)` in a job `input`.
import { check } from "@keel/check";
import "@keel/std-jobs/tools";
import { expect, it } from "vitest";

const files = (schemaImport: string, input: string) => [
  {
    path: "modules/orders/module.ts",
    source: `import { module } from "@keel/compiler"\nexport default module({ id: "orders", deps: ["@keel/std-jobs"], capabilities: [] })\n`,
  },
  {
    path: "modules/orders/send.server.ts",
    source: `import { job } from "@keel/std-jobs"\n${schemaImport}\nexport const send = job({ input: ${input} }, async () => null)\n`,
  },
];
const found = (fs: ReturnType<typeof files>) =>
  check(fs, { types: false }).diagnostics.filter((d) => d.code === "E2503");

it("E2503 fires for `k.s.secret` through `import * as k` and not for a non-schema namespace or a plain field", () => {
  const ns = 'import * as k from "@keel/schema"';
  expect(found(files(ns, "k.s.object({ t: k.s.secret() })"))).toHaveLength(1);
  expect(found(files(ns, "k.s.object({ t: k.s.string() })"))).toEqual([]);
  expect(found(files('import * as k from "other"', "k.s.object({ t: k.s.secret() })"))).toEqual([]);
});
