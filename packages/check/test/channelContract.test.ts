// k.contract, std.contracts: a module serving a channel writes its two entries out in its contract, naming the
// channel's schemas, and binds `channelRoute`'s handlers by entry; keel check's route rules read that module
// statically and report nothing, and a `.pii()` in the channel's params is E1111 at the entry's `query`.
import { describe, expect, it } from "vitest";
import { check } from "../src/check.ts";
import type { SourceFile } from "../src/index.ts";

const file = (path: string, ...lines: string[]): SourceFile => ({
  path: `modules/api/${path}`,
  source: lines.join("\n"),
});
const S = "import { s } from '@keel/schema'";
const moduleFile = file(
  "module.ts",
  "import { module } from '@keel/compiler'",
  "export default module({ id: 'api', deps: ['@keel/std-channels'], capabilities: [], public: { exports: [] } })",
);
const params = (pii: boolean): SourceFile =>
  file(
    "BoardParams.schema.ts",
    S,
    `export const BoardParams = s.object({ room: s.string()${pii ? ".pii('contact')" : ""} })`,
  );
const files = (pii = false, entries?: string): SourceFile[] => [
  moduleFile,
  params(pii),
  file("BoardMessage.schema.ts", S, "export const BoardMessage = s.object({ text: s.string() })"),
  file("Board.schema.ts", S, "export const Board = s.object({ n: s.int() })"),
  file(
    "boardChannel.schema.ts",
    "import { channel } from '@keel/std-channels'",
    "import { BoardMessage } from './BoardMessage.schema.ts'",
    "import { BoardParams } from './BoardParams.schema.ts'",
    "export const boardChannel = channel('api.board', { path: '/api/board/events', params: BoardParams, message: BoardMessage })",
  ),
  file(
    "api.contract.ts",
    "import { contract } from '@keel/router/contract'",
    S,
    "import { Board } from './Board.schema.ts'",
    "import { BoardParams } from './BoardParams.schema.ts'",
    "import { boardChannel } from './boardChannel.schema.ts'",
    "export const api = contract('api', {",
    entries ??
      [
        "  'api.boardEvents': { method: 'GET', path: '/api/board/events', query: BoardParams, events: true, output: boardChannel.events },",
        "  'api.boardPublish': { method: 'POST', path: '/api/board/events', query: BoardParams, body: boardChannel.body, output: s.object({}) },",
      ].join("\n"),
    "  'api.board': { method: 'GET', path: '/api/board', output: Board },",
    "})",
  ),
  file(
    "boardEvents.server.ts",
    "import { channelRoute } from '@keel/std-channels/server'",
    "import { api } from './api.contract.ts'",
    "import { boardChannel } from './boardChannel.schema.ts'",
    "export const boardEvents = channelRoute(api, boardChannel, { id: 'api.boardEvents', publish: 'api.boardPublish', stores: () => ({}), member: () => true })",
  ),
  file(
    "loadBoard.server.ts",
    "import { loader } from '@keel/router'",
    "import { ok } from '@keel/schema'",
    "import { api } from './api.contract.ts'",
    "export const loadBoard = loader(api, 'api.board', {}, async () => ok({ n: 1 }))",
  ),
  file(
    "routes.ts",
    "import { manifest } from '@keel/router'",
    "import { api } from './api.contract.ts'",
    "import { boardEvents } from './boardEvents.server.ts'",
    "import { loadBoard } from './loadBoard.server.ts'",
    "export const routes = manifest(api, {",
    "  'api.boardEvents': { loader: boardEvents.loader },",
    "  'api.boardPublish': { action: boardEvents.action },",
    "  'api.board': { loader: loadBoard },",
    "})",
  ),
];
const topology = { web: { modules: ["api"], adapter: "node" as const } };
const run = (fs: SourceFile[]) => check(fs, { types: false, topology }).diagnostics;
const at = (fs: SourceFile[], d: { path: string; line: number; col: number }): string => {
  const src = fs.find((f) => f.path === d.path)?.source.split("\n")[d.line - 1] ?? "";
  return src.slice(d.col - 1, d.col + 20);
};

describe("a channel in a module's contract", () => {
  it("is read statically: no diagnostic for the module's contract, binding or channel", () => {
    expect(run(files()).map((d) => `${d.code} ${d.path}:${d.line} ${d.message}`)).toEqual([]);
  });

  it("a .pii() in the channel's params is E1111 at each entry's query", () => {
    const fs = files(true);
    const hits = run(fs).filter((d) => d.code === "E1111");
    expect(hits.map((d) => [d.path, at(fs, d).slice(0, 5)])).toEqual([
      ["modules/api/api.contract.ts", "query"],
      ["modules/api/api.contract.ts", "query"],
    ]);
  });

  it("a spread of a call in the contract is E1111 unread at the spread, and the other entries are still read", () => {
    const spread =
      "  ...channelEntries(boardChannel, { id: 'api.boardEvents' }),\n  'api.boardFeed': { method: 'GET', path: '/api/feed', query: BoardParams, output: Board },";
    const fs = files(true, spread);
    const hits = run(fs).filter((d) => d.code === "E1111");
    expect(hits.map((d) => [at(fs, d).slice(0, 8), d.message])).toEqual([
      ["...chann", "route entries not readable statically; cannot show it holds no .pii()"],
      ["query: B", "personal data or a secret in route query; a URL reaches history and logs"],
    ]);
  });
});
