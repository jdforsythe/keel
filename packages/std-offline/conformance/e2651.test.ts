// Spec: std.offline, clause "`outbox` throws E2651 for an api with a nested `s.secret` in an endpoint body; `keel check` reports E2651 on that fixture and nothing on its clean twin."
// Spec: std.offline, rule E2651: an `outbox` whose api has an endpoint body holding an `s.secret`.
// Seed 1337
// Assumption: as for std.jobs E2503, `check()` imports nothing, so the rule registers by importing `@keel/std-offline/tools`;
// a module is the files under `modules/<id>/` with a `module.ts` listing `deps`.
import { check } from "@keel/check";
import { scope } from "@keel/reactive";
import { type Schema, s } from "@keel/schema";
import { endpoints } from "@keel/services";
import { Write, outbox } from "@keel/std-offline";
import "@keel/std-offline/tools";
import fc from "fast-check";
import { expect, test } from "vitest";

type Wrap = "object" | "optionalField" | "array" | "nullable" | "record";
const wrapsArb = fc.array(fc.constantFrom<Wrap>("object", "optionalField", "array", "nullable", "record"), {
  maxLength: 4,
});

function nest(leaf: Schema<unknown>, wraps: readonly Wrap[]): Schema<unknown> {
  let schema = leaf;
  for (const w of wraps) {
    if (w === "object") schema = s.object({ k: schema });
    else if (w === "optionalField") schema = s.object({ k: schema.optional() });
    else if (w === "array") schema = s.array(schema);
    else if (w === "nullable") schema = schema.nullable();
    else schema = s.record(schema);
  }
  return schema;
}

let n = 0;
const declare = (secret: boolean, wraps: readonly Wrap[]) => () => {
  const api = endpoints({
    save: {
      method: "POST",
      path: "/save",
      body: s.object({ field: nest(secret ? s.secret(s.string()) : s.string(), wraps), write: Write }),
      output: s.object({}),
    },
  });
  return outbox(`e2651${++n}.outbox`, api);
};

test("`outbox` throws E2651 for an api with a nested `s.secret` in an endpoint body, and not for its clean twin.", () => {
  fc.assert(
    fc.property(wrapsArb, (wraps) => {
      const sc = scope(() => {
        expect(declare(true, wraps)).toThrow(/^E2651\b/);
        expect(declare(false, wraps)).not.toThrow();
      });
      sc.dispose();
    }),
    { seed: 1337, numRuns: 40 },
  );
});

type Files = Parameters<typeof check>[0];
const manifest = `import { module } from "@keel/compiler"
export default module({ id: "todos", deps: ["@keel/std-offline"], capabilities: ["clock", "net", "random", "storage"] })
`;
const apiFile = (field: string) => `import { endpoints } from "@keel/services"
import { Write } from "@keel/std-offline"
import { s } from "@keel/schema"
export const TodosApi = endpoints({
  editTodo: { method: "POST", path: "/todos/:todoId", params: s.object({ todoId: s.string() }), body: s.object({ ${field}, write: Write }), output: s.object({}) },
})
`;
const outboxFile = `import { outbox } from "@keel/std-offline"
import { TodosApi } from "./TodosApi.schema.ts"
export const boardOutbox = outbox("todos.outbox", TodosApi, { limit: 100 })
`;
const project = (field: string): Files => [
  { path: "modules/todos/module.ts", source: manifest },
  { path: "modules/todos/TodosApi.schema.ts", source: apiFile(field) },
  { path: "modules/todos/boardOutbox.ts", source: outboxFile },
  {
    path: "topology.ts",
    source: `import { topology } from "@keel/server"\nexport default topology({ web: { modules: ["todos"], adapter: "node" } })\n`,
  },
];
const found = async (files: Files) =>
  (await check(files, { types: false })).diagnostics.filter((d) => d.code === "E2651");
const word = fc.stringMatching(/^[a-z]{3,10}$/);

test("`keel check` reports E2651 on an outbox whose api body holds an `s.secret` and nothing on its clean twin.", async () => {
  await fc.assert(
    fc.asyncProperty(word, async (field) => {
      expect(await found(project(`${field}: s.object({ inner: s.secret(s.string()) })`))).toHaveLength(1);
      expect(await found(project(`${field}: s.object({ inner: s.string() })`))).toHaveLength(0);
    }),
    { seed: 1337, numRuns: 15 },
  );
});
