// Shared project fixtures for the std.postgres check-rule files (not a test file).
// Assumption: as for std.db E2151 and std.workflows, `check()` imports nothing, so the rules register by importing `@keel/std-postgres/tools`;
// a module is the files under `modules/<id>/` with a `module.ts`; a migration is a file `modules/kitchen/migrations/NNNN-<kebab>.sql`.
import { check } from "@keel/check";
import "@keel/std-postgres/tools";

export type Files = Parameters<typeof check>[0];
export const manifest = `import { module } from "@keel/compiler"
export default module({ id: "kitchen", deps: ["@keel/std-postgres"], capabilities: ["clock", "random", "kitchen.db"] })
`;
export const topo = (adapter: string) => `import { topology } from "@keel/server"
export default topology({ web: { modules: ["kitchen"], adapter: "${adapter}" } })
`;
export const found = (files: Files, code: string) =>
  check(files, { types: false }).diagnostics.filter((d) => d.code === code);
export const MIGRATION = "create table recipes (id int primary key, title text not null)";
export const dbFile = (name: string, extra = "") => `import { database } from "@keel/std-postgres/server"
export const kitchenDb = database(${name}, {
  migrations: import.meta.glob<string>("./migrations/*.sql", { query: "?raw", import: "default", eager: true }),
})
${extra}`;
export const project = (path: string, source: string, adapter = "node", sql = MIGRATION): Files => [
  { path: "modules/kitchen/module.ts", source: manifest },
  { path, source },
  { path: "modules/kitchen/migrations/0001-init.sql", source: sql },
  { path: "topology.ts", source: topo(adapter) },
];
