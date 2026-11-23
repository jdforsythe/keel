// std.multi, the hub between a group's users and its server, over a server scripted per request: what reaches the
// server (method, url, headers, body, the user's own cookies), what comes back to the user (a whole body, a body in
// chunks, a server that throws, a body that breaks off, a response with no body), each user's cookie jar, the group's
// clock, and what the recorded group holds.
// Seed 7 (no random inputs)
import type { SimCtx } from "@keel/ctx";
import { describe, expect, test } from "vitest";
import { ORIGIN, USER } from "../conformance/group-fixtures.ts";
import { openGroup } from "../src/group/index.ts";

type Seen = { method: string; path: string; headers: Record<string, string>; body: string };
type Script = (req: Request, ctx: SimCtx) => Response | Promise<Response>;
const json = { "content-type": "application/json" };
const board = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({ title: "Milk", head: 0, items: [], caller: "nobody", ...over });
const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

describe("group hub", () => {
  test("requests, responses, cookie jars, the clock and the recorded group", async () => {
    const seen: Seen[] = [];
    let script: Script = () => new Response(board(), { headers: json });
    const stored = { state: { title: "Stored" }, log: [], initial: { title: "" }, head: 0 };
    const g = await openGroup({
      user: USER,
      users: 2,
      seed: 7,
      origin: ORIGIN,
      at: 30,
      server: { board: stored, text: "already text" },
      serve: (ctx) => ({
        fetch: async (req) => {
          const url = new URL(req.url);
          seen.push({
            method: req.method,
            path: `${url.pathname}${url.search}`,
            headers: Object.fromEntries(req.headers),
            body: await req.clone().text(),
          });
          return script(req, ctx);
        },
      }),
    });
    const click = async (u: number, id: string): Promise<void> => {
      await g.user(u).fire(id, { type: "click" });
      await g.settle();
    };
    const text = async (u: number, id: string): Promise<string> => (await g.user(u).find(id)).text;
    let group: Awaited<ReturnType<typeof g.stop>> | undefined;
    try {
      // A GET reaches the server with the user's headers, no body and, at first, no cookie.
      await click(0, "board.refresh");
      expect(seen).toEqual([
        {
          method: "GET",
          path: "/api/board",
          headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1" },
          body: "",
        },
      ]);
      expect(await text(0, "board.title")).toBe("Milk");
      expect(await text(0, "board.status")).toBe("ok");
      expect(await g.user(0).state()).toEqual({
        view: { title: "Milk", head: 0, items: [], caller: "nobody", note: "", status: "ok" },
      });

      // A POST carries its body.
      await g.user(0).fire("board.note", { type: "input", value: "eggs" });
      script = () => new Response(board({ items: ["eggs"], head: 1 }), { headers: json });
      await click(0, "board.write");
      expect(seen.at(-1)).toMatchObject({ method: "POST", path: "/api/append", body: '{"text":"eggs"}' });
      expect(await text(0, "board.items")).toBe("eggs");

      // A cookie the server sets comes back from that user only; a second one joins it; Max-Age=0 takes one away.
      script = () =>
        new Response(board(), {
          headers: [
            ["content-type", "application/json"],
            ["set-cookie", "sid=u0; Path=/"],
            ["set-cookie", "theme=dark; Path=/"],
          ],
        });
      await click(0, "board.refresh");
      script = () => new Response(board(), { headers: json });
      await click(0, "board.refresh");
      expect(seen.at(-1)?.headers.cookie).toBe("sid=u0; theme=dark");
      await click(1, "board.refresh");
      expect(seen.at(-1)?.headers).not.toHaveProperty("cookie");
      script = () => new Response(board(), { headers: { ...json, "set-cookie": "theme=; Path=/; Max-Age=0" } });
      await click(0, "board.refresh");
      script = () => new Response(board(), { headers: json });
      await click(0, "board.refresh");
      expect(seen.at(-1)?.headers.cookie).toBe("sid=u0");

      // A server that throws, a body that breaks off, and a response with no body all fail the user's request.
      script = () => {
        throw new Error("server down");
      };
      await click(0, "board.refresh");
      expect(await text(0, "board.status")).toBe("offline");
      script = () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(bytes('{"title":"cut'));
              c.error(new Error("reset"));
            },
          }),
          { headers: json },
        );
      await click(1, "board.refresh");
      expect(await text(1, "board.status")).toBe("offline");
      script = () => new Response(null, { status: 204 });
      await click(1, "board.rename");
      expect(await text(1, "board.status")).toBe("offline");

      // A body sent in chunks arrives whole; a status other than 200 keeps its body.
      const whole = board({ title: "In three chunks" });
      script = () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(bytes(whole.slice(0, 7)));
              c.enqueue(bytes(whole.slice(7, 20)));
              c.enqueue(bytes(whole.slice(20)));
              c.close();
            },
          }),
          { status: 201, headers: json },
        );
      await click(1, "board.refresh");
      expect(await text(1, "board.title")).toBe("In three chunks");
      expect(await text(1, "board.status")).toBe("ok");
      expect(await text(0, "board.title")).toBe("Milk");

      // The server sees its own storage and clock; the group's clock moves forward only.
      script = async (_req, ctx) =>
        new Response(board({ title: String(await ctx.storage.get("keel.store.text")), head: ctx.clock.now() }), {
          headers: json,
        });
      await click(0, "board.refresh");
      expect(await g.user(0).state()).toMatchObject({ view: { title: "already text", head: 30 } });
      await g.advance(25);
      await g.advance(-10);
      await g.advance(0);
      await click(0, "board.refresh");
      expect(await g.user(0).state()).toMatchObject({ view: { head: 55 } });

      // One user offline: its request never leaves, the other's still does.
      const before = seen.length;
      await g.setOnline(1, false);
      await click(1, "board.probe");
      expect(await text(1, "board.status")).toBe("false");
      await click(1, "board.refresh");
      expect(await text(1, "board.status")).toBe("offline");
      expect(seen).toHaveLength(before);
      await click(0, "board.probe");
      expect(await text(0, "board.status")).toBe("true");
      await g.setOnline(1, true);
      await click(1, "board.probe");
      expect(await text(1, "board.status")).toBe("true");

      // A user that is not there.
      expect(() => g.user(2)).toThrow(new RangeError("group: no user 2 (users: 2)"));
      expect(() => g.user(-1)).toThrow(RangeError);
      await expect(g.setOnline(2, false)).rejects.toThrow("group: no user 2 (users: 2)");
      await expect(g.user(0).find("board.nope")).rejects.toMatchObject({ code: "E1705" });
      await expect(g.user(0).navigate("/nowhere")).rejects.toThrow("group: no route matches /nowhere");
    } finally {
      group = await g.stop();
    }
    expect(group).toMatchObject({ v: 1, seed: 7, at: 30, origin: ORIGIN });
    expect(group.server).toEqual({ board: JSON.stringify(stored), text: "already text" });
    expect("schedule" in group).toBe(false);
    expect(group.users).toHaveLength(2);
    const [first, second] = group.users;
    expect(first?.at).toBe(30);
    expect(first?.seed).not.toBe(second?.seed);
    expect(first?.events.filter((e) => e.kind === "fire").map((e) => e.at)).toEqual([
      30, 30, 30, 30, 30, 30, 30, 30, 30, 55, 55,
    ]);
    expect(second?.events.filter((e) => e.kind === "net")).toEqual([
      { at: 55, kind: "net", online: false },
      { at: 55, kind: "net", online: true },
    ]);
    expect(first?.events.some((e) => e.kind === "net")).toBe(false);
  }, 240_000);
});
