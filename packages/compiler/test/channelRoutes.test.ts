// k.compiler Artifacts, std.contracts: a module serving a channel writes the channel's two entries out in its
// contract and binds `channelRoute`'s handlers by entry. `routeLiterals` reads every route of it statically (nothing
// unread, the id set closed), and the build's evaluated `routes.json` holds the same ids, paths and methods.
import fs from "node:fs";
import path from "node:path";
import keel from "@keel/compiler/vite";
import { fixedTime } from "@keel/tooling/test-time";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { routeLiterals } from "../src/routeLiterals.ts";
import type { SourceFile } from "../src/types/SourceFile.ts";

// Real packages dir via a workspace link, so this also holds in Stryker's sandbox copy (where ../.. is not packages/).
const packages = path.dirname(fs.realpathSync(path.join(import.meta.dirname, "..", "node_modules", "@keel", "schema")));
const S = 'import { s } from "@keel/schema";';
const FILES: Readonly<Record<string, string>> = {
  "modules/api/module.ts": `import { module } from "@keel/compiler";
export default module({ id: "api", deps: ["@keel/std-channels"], capabilities: [], public: { exports: [] } });
`,
  "modules/api/BoardParams.schema.ts": `${S}\nexport const BoardParams = s.object({});\n`,
  "modules/api/BoardMessage.schema.ts": `${S}\nexport const BoardMessage = s.object({ text: s.string() });\n`,
  "modules/api/Board.schema.ts": `${S}\nexport const Board = s.object({ n: s.int() });\n`,
  "modules/api/boardChannel.schema.ts": `import { channel } from "@keel/std-channels";
import { BoardMessage } from "./BoardMessage.schema.ts";
import { BoardParams } from "./BoardParams.schema.ts";
export const boardChannel = channel("api.board", { path: "/api/board/events", params: BoardParams, message: BoardMessage });
`,
  "modules/api/api.contract.ts": `import { contract } from "@keel/router/contract";
${S}
import { Board } from "./Board.schema.ts";
import { BoardParams } from "./BoardParams.schema.ts";
import { boardChannel } from "./boardChannel.schema.ts";
export const api = contract("api", {
  "api.boardEvents": { method: "GET", path: "/api/board/events", query: BoardParams, events: true, output: boardChannel.events },
  "api.boardPublish": { method: "POST", path: "/api/board/events", query: BoardParams, body: boardChannel.body, output: s.object({}) },
  "api.board": { method: "GET", path: "/api/board", output: Board },
});
`,
  "modules/api/boardEvents.server.ts": `import { channelRoute } from "@keel/std-channels/server";
import { api } from "./api.contract.ts";
import { boardChannel } from "./boardChannel.schema.ts";
export const boardEvents = channelRoute(api, boardChannel, { id: "api.boardEvents", publish: "api.boardPublish", stores: () => ({}), member: () => true });
`,
  "modules/api/loadBoard.server.ts": `import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { api } from "./api.contract.ts";
export const loadBoard = loader(api, "api.board", {}, async () => ok({ n: 1 }));
`,
  "modules/api/routes.ts": `import { manifest } from "@keel/router";
import { api } from "./api.contract.ts";
import { boardEvents } from "./boardEvents.server.ts";
import { loadBoard } from "./loadBoard.server.ts";
export const routes = manifest(api, {
  "api.boardEvents": { loader: boardEvents.loader },
  "api.boardPublish": { action: boardEvents.action },
  "api.board": { loader: loadBoard },
});
`,
};
const sources: SourceFile[] = Object.entries(FILES).map(([p, source]) => ({ path: p, source }));
const api = { file: "modules/api/api.contract.ts", layout: null, guard: null, params: false, api: true };

let root = "";
beforeEach(() => {
  root = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-channel-routes-"));
  fs.mkdirSync(path.join(root, "node_modules", "@keel"), { recursive: true });
  for (const p of fs.readdirSync(packages))
    if (fs.existsSync(path.join(packages, p, "package.json")))
      fs.symlinkSync(path.join(packages, p), path.join(root, "node_modules", "@keel", p));
  for (const [rel, text] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("a channel in a module's contract", () => {
  it("is read statically: every route, nothing unread, the id set closed", () => {
    expect(routeLiterals(sources, { root })).toEqual({
      routes: {
        "api.boardEvents": { ...api, path: "/api/board/events", method: "GET", search: true, actions: [] },
        "api.boardPublish": { ...api, path: "/api/board/events", method: "POST", search: true, actions: ["POST"] },
        "api.board": { ...api, path: "/api/board", method: "GET", search: false, actions: [] },
      },
      closed: true,
      unread: [],
    });
  });

  // The plugin's build start compiles the fixture's sources and imports the stdlib it names: about 3.5 s here, so 60 s.
  it(
    "builds a routes.json holding the same ids, paths and methods, with no warning",
    { timeout: fixedTime(60_000) },
    async () => {
      const warnings: string[] = [];
      const p = keel();
      p.configResolved({ root, command: "build" });
      await p.buildStart.call({ warn: (m: string) => void warnings.push(m) });
      expect(warnings).toEqual([]);
      const v: unknown = JSON.parse(fs.readFileSync(path.join(root, ".keel", "routes.json"), "utf8"));
      const data: unknown = typeof v === "object" && v !== null ? Reflect.get(v, "data") : undefined;
      const pick = (id: string): unknown[] => {
        const r: unknown = typeof data === "object" && data !== null ? Reflect.get(data, id) : undefined;
        return typeof r === "object" && r !== null ? [Reflect.get(r, "path"), Reflect.get(r, "method")] : [];
      };
      expect(pick("api.boardEvents")).toEqual(["/api/board/events", "GET"]);
      expect(pick("api.boardPublish")).toEqual(["/api/board/events", "POST"]);
      expect(pick("api.board")).toEqual(["/api/board", "GET"]);
    },
  );
});
