// E2651 through `keel check` for the forms the conformance fixture does not use: an inline map and a same-file const.
import { check } from "@keel/check";
import { expect, test } from "vitest";
import "../src/tools/index.ts";

const file = (api: string) => ({
  path: "modules/todos/boardOutbox.ts",
  source: `import { contract } from "@keel/router/contract"
import { outbox, Write } from "@keel/std-offline"
import { s } from "@keel/schema"
const Body = s.object({ pin: s.secret(s.string()), write: Write })
const Api = contract("todos", { "todos.save": { method: "POST", path: "/s", body: Body, output: s.object({}) } })
export const boardOutbox = outbox("todos.outbox", ${api})
`,
});
const found = async (api: string) =>
  (await check([file(api)], { types: false })).diagnostics.filter((d) => d.code === "E2651");

test("E2651 follows a same-file const map and a const body", async () => {
  expect(await found("Api")).toHaveLength(1);
});

test("E2651 reads an inline map, and nothing on a clean body", async () => {
  const inline = (body: string) =>
    `contract("todos", { "todos.save": { method: "POST", path: "/s", body: ${body}, output: s.object({}) } })`;
  expect(await found(inline("s.object({ k: s.secret(s.string()) })"))).toHaveLength(1);
  expect(await found(inline("s.object({ k: s.string() })"))).toHaveLength(0);
});
