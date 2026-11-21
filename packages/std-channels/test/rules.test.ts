import { check } from "@keel/check";
import { expect, test } from "vitest";
import "../src/tools/index.ts";

type Files = Parameters<typeof check>[0];
const codes = (files: Files, code: string) =>
  check(files, { types: false })
    .diagnostics.filter((d) => d.code === code)
    .map((d) => `${d.path}:${d.line}`);
const mod = {
  path: "modules/chan/module.ts",
  source: `import { module } from "@keel/compiler"\nexport default module({ id: "chan", deps: ["@keel/std-channels"], capabilities: ["clock", "net", "observe"] })\n`,
};
const route = `import { channelRoute as serve } from "@keel/std-channels/server"\nimport { boardChannel } from "./boardChannel.ts"\nexport const a = serve(boardChannel, { id: "chan.a", stores: () => ({}), member: () => true })\nexport const b = serve(boardChannel, { id: "chan.b", stores: () => ({}), member: () => true })\n`;

test("E2601 fires once per channelRoute call, under any local name, outside *.server.ts app files only", () => {
  expect(codes([mod, { path: "modules/chan/boardEvents.ts", source: route }], "E2601")).toEqual([
    "modules/chan/boardEvents.ts:3",
    "modules/chan/boardEvents.ts:4",
  ]);
  expect(codes([mod, { path: "modules/chan/boardEvents.server.ts", source: route }], "E2601")).toEqual([]);
  expect(codes([mod, { path: "modules/chan/boardEvents.test.ts", source: route }], "E2601")).toEqual([]);
});

test("E2602 fires for a message schema const of the same file holding s.secret, at the message", () => {
  const source = (inner: string) =>
    `import { channel } from "@keel/std-channels"\nimport { s } from "@keel/schema"\nconst Msg = s.object({ t: ${inner} })\nexport const boardChannel = channel("chan.board", { path: "/e", params: s.object({}), message: Msg })\n`;
  const at = (inner: string) => codes([mod, { path: "modules/chan/boardChannel.ts", source: source(inner) }], "E2602");
  expect(at("s.array(s.secret(s.string()))")).toEqual(["modules/chan/boardChannel.ts:4"]);
  expect(at("s.array(s.string())")).toEqual([]);
});
