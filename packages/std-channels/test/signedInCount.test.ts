// @vitest-environment node
// std.channels-limits: a stream whose request has a `user` (the identity source's answer, k.user) counts against that
// user's own `perCaller` on the module, never the anonymous `perAnonymous`; with no user and no caller cookie it is
// anonymous. A client cannot assert a user: a header the identity source does not accept, or an unsigned
// `x-keel-user`, leaves the request anonymous.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stdArtifact } from "@keel/compiler";
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { createApp, identity, topology } from "@keel/server";
import { afterEach, beforeEach, expect, test } from "vitest";
import { channel } from "../src/channel.ts";
import { channelRoute } from "../src/server/channelRoute.ts";

const room = channel("q.room", { path: "/api/q/events", params: s.object({}) });
/** The identity source: a session token the app issued names its user; anything else is no user. */
const TOKENS: Record<string, string> = { "tok-ada": "ada", "tok-bo": "bo" };

let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "keel-channels-signed-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const serve = async (withIdentity: boolean) => {
  const q = contract("q", {
    "q.room": { method: "GET", path: "/api/q/events", query: room.params, events: true, output: room.events },
  });
  const route = channelRoute(q, room, { id: "q.room", member: () => true });
  const std = join(dir, "std.json");
  const source = `import { module } from "@keel/compiler"\nexport default module({ id: "q", deps: ["@keel/std-channels"], capabilities: ["clock", "net", "observe"], std: { "@keel/std-channels": { perAnonymous: 2, perCaller: 2 } } })\n`;
  writeFileSync(std, JSON.stringify(stdArtifact([{ path: "modules/q/module.ts", source }])));
  const app = await createApp({
    topology: topology({ web: { modules: ["q"], adapter: "node" } }),
    routes: manifest(q, { "q.room": { loader: route.loader } }),
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "dev",
    std,
    ...(withIdentity
      ? { identity: identity({ identify: async ({ request }) => TOKENS[request.headers.get("x-u") ?? ""] ?? "" }) }
      : {}),
  });
  const aborts: AbortController[] = [];
  /** The first event of a stream opened with `headers`. */
  const first = async (headers: Record<string, string> = {}): Promise<string> => {
    const ac = new AbortController();
    aborts.push(ac);
    const res = await app.fetch(
      new Request("http://localhost/api/q/events", {
        headers: { accept: "text/event-stream", ...headers },
        signal: ac.signal,
      }),
    );
    const chunk = await res.body?.getReader().read();
    return new TextDecoder().decode(chunk?.value);
  };
  const close = async (): Promise<void> => {
    for (const ac of aborts) ac.abort();
    await app.close();
  };
  return { first, close };
};

test("a signed-in request with no caller cookie opens while the anonymous count is full; each user has their own perCaller", async () => {
  const { first, close } = await serve(true);
  try {
    expect(await first()).toContain("reset");
    expect(await first()).toContain("reset");
    expect(await first()).toContain('"full"');
    expect(await first({ "x-u": "tok-ada" })).toContain("reset");
    expect(await first({ "x-u": "tok-ada" })).toContain("reset");
    expect(await first({ "x-u": "tok-ada" })).toContain('"full"');
    // a second user does not share ada's count
    expect(await first({ "x-u": "tok-bo" })).toContain("reset");
    expect(await first({ "x-u": "tok-bo" })).toContain("reset");
    expect(await first({ "x-u": "tok-bo" })).toContain('"full"');
    // the anonymous count is untouched by them: still full
    expect(await first()).toContain('"full"');
  } finally {
    await close();
  }
});

test("a client cannot assert a user: an unaccepted token or an unsigned x-keel-user is anonymous", async () => {
  for (const withIdentity of [true, false]) {
    const { first, close } = await serve(withIdentity);
    try {
      expect(await first()).toContain("reset");
      expect(await first()).toContain("reset");
      expect(await first({ "x-u": "ada" })).toContain('"full"');
      expect(await first({ "x-keel-user": "ada" })).toContain('"full"');
    } finally {
      await close();
    }
  }
});
