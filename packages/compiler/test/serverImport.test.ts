// E1004 (k.compiler): a *.server.ts module reached from client code by a value import, a re-export or a literal import().
import { compile } from "@keel/compiler";
import { expect, it } from "vitest";

const e1004 = (path: string, source: string): string[] =>
  compile([{ path, source }])
    .diagnostics.filter((d) => d.code === "E1004")
    .map((d) => d.message);

it("a barrel re-export and a dynamic import of a server module are E1004; type-only forms are not", () => {
  expect(e1004("modules/a/index.ts", "export { api } from './api.server.ts'\n")).toHaveLength(1);
  expect(e1004("modules/a/index.ts", "export * from './api.server.ts'\n")).toHaveLength(1);
  expect(e1004("modules/a/Pay.ts", "export const load = () => import('./api.server.ts')\n")).toHaveLength(1);
  expect(e1004("modules/a/Pay.ts", "export const load = () => import(`./api.server`)\n")).toHaveLength(1);
  expect(e1004("modules/a/index.ts", "export type { Api } from './api.server.ts'\n")).toEqual([]);
  expect(e1004("modules/a/index.ts", "export { api } from './api.ts'\n")).toEqual([]);
});

it("a server module may re-export and import another server module", () => {
  expect(
    e1004(
      "modules/a/all.server.ts",
      "export { api } from './api.server.ts'\nexport const f = () => import('./b.server.ts')\n",
    ),
  ).toEqual([]);
});
