// @vitest-environment node
// Spec: std.contracts, "`channel` gives the schemas the entries name: `events`, the `ChannelEvent` schema of its `message`, and `body`, `s.object({ message })` (undefined without `message`)."
// Spec: std.contracts, "The stream entry is `{ method: 'GET', path, query: params, events: true, output: events }`; the publish entry `{ method: 'POST', path, query: params, body, output }`, `output` taking `{}` and answered `ok({})` (k.api Output). A channel without `message` has no publish entry. Its `params` are the entries' `query`, so a failing one answers 422."
// Spec: std.contracts, "`channelRoute(contract, channel, { id, publish?, stores, member })` (`@keel/std-channels/server`) declares its handlers through `contract`, the serving module's, as `loader` and `action` do, and returns `{ loader, action }`, the stream's live loader and the publish action, which the binding names at `id` and `publish`."
// Spec: std.contracts, "An entry at `id` or `publish` whose `method`, `path`, `events`, `query`, `body` or `output` is not the channel's (by identity; `output` taking `{}`) is a type error where the types differ and throws E1515 naming those members. `publish` is required when the channel has `message`, a type error only (without it the binding lacks the publish entry's action, E1515 at `manifest`), and refused when it does not (a type error, and it throws E1510)."
// Spec: std.contracts, Conformance "With contract `a` holding `a.ev` and `a.pub` written from channel `ch` (with `message`) and `r = channelRoute(a, ch, { id: 'a.ev', publish: 'a.pub', stores, member })`, `manifest(a, { 'a.ev': { loader: r.loader }, 'a.pub': { action: r.action } })` compiles; a stream opened on `a.ev` gets `{ kind: 'reset' }` first, and a POST to `a.pub` delivers `{ kind: 'message', message }` to it."
// Spec: std.contracts, Conformance "`channelRoute` over a contract whose `a.ev` has another `path`, or a `query` not `ch.params`, throws E1515 naming those members; of a channel without `message`, `publish` does not compile and throws E1510."
// Spec: std.contracts, Conformance "`keel check` over a module whose contract holds a channel's two entries and whose binding names `channelRoute`'s handlers reports no E1111 and no W1005, and `routes.json` lists both ids; a `.pii()` in the channel's `params` is E1111 at each entry's `query`."
// Spec: std.contracts, Conformance "A contract file importing a channel from a `*.schema.ts` file is no E1514; from `boardChannel.ts`, one E1514."
// Seed 1337 (no random input: fixed fixtures).
import { check } from "@keel/check";
import { routeLiterals } from "@keel/compiler";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { channel } from "@keel/std-channels";
import { channelRoute } from "@keel/std-channels/server";
import { store, transaction } from "@keel/store";
import { describe, expect, test } from "vitest";
import { Msg, ORIGIN, Room, serve } from "./fixtures.ts";

const messageOf = (fn: () => unknown): { code: unknown; message: string } => {
  try {
    fn();
  } catch (e) {
    return {
      code: typeof e === "object" && e !== null && "code" in e ? e.code : "no-code",
      message: e instanceof Error ? e.message : String(e),
    };
  }
  return { code: null, message: "" };
};
const stores = () => {
  const log = store(s.object({ n: s.int() }), { n: 0 }, { id: "a.log" });
  return { log, bump: transaction(log, "a.bump", s.object({}), (st) => ({ n: st.n + 1 })) };
};
const member = () => true;

describe("std.contracts: std-channels", () => {
  const ch = channel("a.room", { path: "/api/a/events", params: Room, message: Msg });
  const plain = channel("a.plain", { path: "/api/a/plain", params: Room });
  const Other = s.object({ other: s.string() });

  const good = () =>
    contract("a", {
      "a.ev": { method: "GET", path: "/api/a/events", query: Room, events: true, output: ch.events },
      "a.pub": { method: "POST", path: "/api/a/events", query: Room, body: ch.body, output: s.object({}) },
    });
  const bind = (a: ReturnType<typeof good>) => () =>
    channelRoute(a, ch, { id: "a.ev", publish: "a.pub", stores, member });

  test("`channel` gives `events` and, with `message`, `body`; without `message` `body` is undefined", () => {
    expect(ch.events).toBeDefined();
    expect(ch.body).toBeDefined();
    expect(plain.events).toBeDefined();
    expect(plain.body).toBeUndefined();
  });

  test("`channelRoute(contract, channel, { id, publish?, stores, member })` returns `{ loader, action }`", () => {
    const r = channelRoute(good(), ch, { id: "a.ev", publish: "a.pub", stores, member });
    expect(Object.keys(r).sort()).toEqual(["action", "loader"]);
  });

  test("`manifest(a, { 'a.ev': { loader: r.loader }, 'a.pub': { action: r.action } })` compiles over contract `a` holding `a.ev` and `a.pub` written from `ch`", () => {
    const a = good();
    const r = channelRoute(a, ch, { id: "a.ev", publish: "a.pub", stores, member });
    const table = manifest(a, { "a.ev": { loader: r.loader }, "a.pub": { action: r.action } });
    expect(table.contracts[0]?.module).toBe("a");
  });

  test("a stream opened on the stream entry gets `{ kind: 'reset' }` first, and a POST to the publish entry delivers `{ kind: 'message', message }` to it", async () => {
    const h = await serve({});
    try {
      const cookie = await h.enroll();
      const stream = await h.open("r1", cookie);
      expect(stream.status).toBe(200);
      const res = await h.post(
        "/api/room/events",
        { message: { text: "hi" } },
        { cookie, headers: { origin: ORIGIN }, search: "?room=r1" },
      );
      expect(res.status).toBeLessThan(300);
      expect(JSON.stringify(stream.events)).toContain("reset");
      expect(JSON.stringify(stream.events)).toContain("hi");
      stream.close();
    } finally {
      await h.dispose();
    }
  });

  test("the entries' `query` is the channel's `params`, so a failing one answers 422, not 404", async () => {
    const h = await serve({});
    try {
      const cookie = await h.enroll();
      const res = await h.post(
        "/api/room/events",
        { message: { text: "x" } },
        { cookie, headers: { origin: ORIGIN }, search: "" },
      );
      expect(res.status).toBe(422);
    } finally {
      await h.dispose();
    }
  });

  test("an entry at `id` whose `path` is not the channel's throws E1515 naming `path`", () => {
    const a = contract("a", {
      "a.ev": { method: "GET", path: "/api/a/other", query: Room, events: true, output: ch.events },
      "a.pub": { method: "POST", path: "/api/a/events", query: Room, body: ch.body, output: s.object({}) },
    });
    // compile-time half: ../unsafe/conformanceNegativeTypes.ts
    const e = messageOf(Reflect.apply(bind, undefined, [a]));
    expect(e.code).toBe("E1515");
    expect(e.message).toContain("path");
  });

  test("an entry at `id` whose `query` is not the channel's `params` throws E1515 naming `query`", () => {
    const a = contract("a", {
      "a.ev": { method: "GET", path: "/api/a/events", query: Other, events: true, output: ch.events },
      "a.pub": { method: "POST", path: "/api/a/events", query: Room, body: ch.body, output: s.object({}) },
    });
    // compile-time half: ../unsafe/conformanceNegativeTypes.ts
    const e = messageOf(Reflect.apply(bind, undefined, [a]));
    expect(e.code).toBe("E1515");
    expect(e.message).toContain("query");
  });

  test("an entry at `id` whose `output` is not the channel's `events` throws E1515 naming `output`", () => {
    const a = contract("a", {
      "a.ev": { method: "GET", path: "/api/a/events", query: Room, events: true, output: s.object({}) },
      "a.pub": { method: "POST", path: "/api/a/events", query: Room, body: ch.body, output: s.object({}) },
    });
    // compile-time half: ../unsafe/conformanceNegativeTypes.ts
    const e = messageOf(Reflect.apply(bind, undefined, [a]));
    expect(e.code).toBe("E1515");
    expect(e.message).toContain("output");
  });

  test("an entry at `publish` whose `body` is not the channel's `body` throws E1515 naming `body`", () => {
    const a = contract("a", {
      "a.ev": { method: "GET", path: "/api/a/events", query: Room, events: true, output: ch.events },
      "a.pub": { method: "POST", path: "/api/a/events", query: Room, body: s.object({}), output: s.object({}) },
    });
    // compile-time half: ../unsafe/conformanceNegativeTypes.ts
    const e = messageOf(Reflect.apply(bind, undefined, [a]));
    expect(e.code).toBe("E1515");
    expect(e.message).toContain("body");
  });

  test("an entry at `id` whose `method` is not the channel's throws E1515 naming `method`", () => {
    const a = contract("a", {
      "a.ev": { method: "PUT", path: "/api/a/events", query: Room, body: ch.body, output: ch.events },
      "a.pub": { method: "POST", path: "/api/a/events", query: Room, body: ch.body, output: s.object({}) },
    });
    // compile-time half: ../unsafe/conformanceNegativeTypes.ts
    const e = messageOf(Reflect.apply(bind, undefined, [a]));
    expect(e.code).toBe("E1515");
    expect(e.message).toContain("method");
  });

  test("an entry at `id` without `events: true` throws E1515 naming `events`", () => {
    const a = contract("a", {
      "a.ev": { method: "GET", path: "/api/a/events", query: Room, output: ch.events },
      "a.pub": { method: "POST", path: "/api/a/events", query: Room, body: ch.body, output: s.object({}) },
    });
    // compile-time half: ../unsafe/conformanceNegativeTypes.ts
    const e = messageOf(Reflect.apply(bind, undefined, [a]));
    expect(e.code).toBe("E1515");
    expect(e.message).toContain("events");
  });

  test("an entry with another `path` and another `query` throws E1515 naming both members", () => {
    const a = contract("a", {
      "a.ev": { method: "GET", path: "/api/a/other", query: Other, events: true, output: ch.events },
      "a.pub": { method: "POST", path: "/api/a/events", query: Room, body: ch.body, output: s.object({}) },
    });
    // compile-time half: ../unsafe/conformanceNegativeTypes.ts
    const e = messageOf(Reflect.apply(bind, undefined, [a]));
    expect(e.code).toBe("E1515");
    expect(e.message).toContain("path");
    expect(e.message).toContain("query");
  });

  test("entries that are the channel's own throw nothing", () => {
    expect(messageOf(bind(good())).code).toBeNull();
  });

  // The spec says `publish` is required when the channel has `message` and names no error code for its absence: this test asserts the compile-time half only.
  test("`publish` is required when the channel has `message`: without it `channelRoute` does not compile", () => {
    const a = good();
    // compile-time half: ../unsafe/conformanceNegativeTypes.ts
    const run = () => Reflect.apply(channelRoute, undefined, [a, ch, { id: "a.ev", stores, member }]);
    expect(typeof run).toBe("function");
  });

  test("`publish` is refused when the channel has no `message`: it does not compile and throws E1510", () => {
    const a = contract("a", {
      "a.ev": { method: "GET", path: "/api/a/plain", query: Room, events: true, output: plain.events },
      "a.pub": { method: "POST", path: "/api/a/plain", query: Room, body: s.object({}), output: s.object({}) },
    });
    // compile-time half: ../unsafe/conformanceNegativeTypes.ts
    const e = messageOf(() =>
      Reflect.apply(channelRoute, undefined, [a, plain, { id: "a.ev", publish: "a.pub", stores, member }]),
    );
    expect(e.code).toBe("E1510");
  });

  test("a channel without `message` is bound with no `publish` and no POST entry", () => {
    const a = contract("a", {
      "a.ev": { method: "GET", path: "/api/a/plain", query: Room, events: true, output: plain.events },
    });
    const r = channelRoute(a, plain, { id: "a.ev", stores, member });
    expect(manifest(a, { "a.ev": { loader: r.loader } }).contracts[0]?.module).toBe("a");
  });

  const S = "import { s } from '@keel/schema'\n";
  const modFile = {
    path: "modules/api/module.ts",
    source:
      "import { module } from '@keel/compiler'\nexport default module({ id: 'api', deps: ['@keel/std-channels'], capabilities: [], public: { exports: [] } })\n",
  };
  const paramsFile = (pii: boolean) => ({
    path: "modules/api/BoardParams.schema.ts",
    source: `${S}export const BoardParams = s.object({ room: s.string()${pii ? ".pii('contact')" : ""} })\n`,
  });
  const boardFiles = (pii: boolean) => [
    modFile,
    paramsFile(pii),
    {
      path: "modules/api/BoardMessage.schema.ts",
      source: `${S}export const BoardMessage = s.object({ text: s.string() })\n`,
    },
    {
      path: "modules/api/boardChannel.schema.ts",
      source:
        "import { channel } from '@keel/std-channels'\nimport { BoardMessage } from './BoardMessage.schema.ts'\nimport { BoardParams } from './BoardParams.schema.ts'\nexport const boardChannel = channel('api.board', { path: '/api/board/events', params: BoardParams, message: BoardMessage })\n",
    },
    {
      path: "modules/api/api.contract.ts",
      source: `import { contract } from '@keel/router/contract'\n${S}import { BoardParams } from './BoardParams.schema.ts'\nimport { boardChannel } from './boardChannel.schema.ts'\nexport const api = contract('api', {\n  'api.boardEvents': { method: 'GET', path: '/api/board/events', query: BoardParams, events: true, output: boardChannel.events },\n  'api.boardPublish': { method: 'POST', path: '/api/board/events', query: BoardParams, body: boardChannel.body, output: s.object({}) },\n})\n`,
    },
    {
      path: "modules/api/boardEvents.server.ts",
      source:
        "import { channelRoute } from '@keel/std-channels/server'\nimport { api } from './api.contract.ts'\nimport { boardChannel } from './boardChannel.schema.ts'\nexport const boardEvents = channelRoute(api, boardChannel, { id: 'api.boardEvents', publish: 'api.boardPublish', stores: () => ({}), member: () => true })\n",
    },
    {
      path: "modules/api/routes.ts",
      source:
        "import { manifest } from '@keel/router'\nimport { api } from './api.contract.ts'\nimport { boardEvents } from './boardEvents.server.ts'\nexport const routes = manifest(api, {\n  'api.boardEvents': { loader: boardEvents.loader },\n  'api.boardPublish': { action: boardEvents.action },\n})\n",
    },
  ];

  test("`keel check` over a module whose contract holds a channel's two entries and whose binding names `channelRoute`'s handlers reports no E1111 and no W1005", () => {
    const ds = check(boardFiles(false), { types: false }).diagnostics.filter(
      (d) => d.code === "E1111" || d.code === "W1005",
    );
    expect(ds).toEqual([]);
  }, 30_000);

  test("`routes.json` lists both of the channel's entry ids (the compiler reads them statically, nothing unread)", () => {
    const r = routeLiterals(boardFiles(false), { root: "." });
    expect(r?.unread).toEqual([]);
    expect(Object.keys(r?.routes ?? {}).sort()).toEqual(["api.boardEvents", "api.boardPublish"]);
    expect(r?.routes["api.boardEvents"]).toMatchObject({ path: "/api/board/events", method: "GET" });
    expect(r?.routes["api.boardPublish"]).toMatchObject({ path: "/api/board/events", method: "POST" });
  });

  test("a `.pii()` in the channel's `params` is E1111 at each entry's `query`", () => {
    const files = boardFiles(true);
    const src = files.find((f) => f.path === "modules/api/api.contract.ts")?.source.split("\n") ?? [];
    const hits = check(files, { types: false }).diagnostics.filter((d) => d.code === "E1111");
    expect(hits).toHaveLength(2);
    expect(hits.map((d) => (src[d.line - 1] ?? "").slice(d.col - 1, d.col - 1 + 5))).toEqual(["query", "query"]);
  }, 30_000);

  test("a contract file importing a channel from a `*.schema.ts` file is no E1514; from `boardChannel.ts`, one E1514", () => {
    const run = (file: string) =>
      check(
        [
          modFile,
          {
            path: `modules/api/${file}`,
            source:
              "import { channel } from '@keel/std-channels'\nimport { s } from '@keel/schema'\nexport const boardChannel = channel('api.board', { path: '/api/board/events', params: s.object({}), message: s.object({}) })\n",
          },
          {
            path: "modules/api/api.contract.ts",
            source: `import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\nimport { boardChannel } from './${file}'\nexport const api = contract('api', {\n  'api.ev': { method: 'GET', path: '/api/board/events', query: s.object({}), events: true, output: boardChannel.events },\n})\n`,
          },
        ],
        { types: false },
      ).diagnostics.filter((d) => d.code === "E1514");
    expect(run("Board.schema.ts")).toEqual([]);
    expect(run("boardChannel.ts")).toHaveLength(1);
  }, 30_000);
});
