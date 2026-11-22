// Two replicas of the `web` deployable on one Postgres 17 URL, as two `createApp`s behind one balancer: a member's add
// on one reaches a member's list stream open on the other as `changed`, and the re-read there sees the row. Runs only
// where `KEEL_TEST_POSTGRES_URL` is set (CI's Postgres 17 job). Seed 21.
import { randomBytes } from "node:crypto";
import { createCtx } from "@keel/ctx";
import { createApp } from "@keel/server";
import { afterAll, describe, expect, it } from "vitest";
import source from "../identity.server.ts";
import topology from "../topology.ts";
import { asJson, signIn, webRoutes } from "./serve.ts";

const PG17 = process.env.KEEL_TEST_POSTGRES_URL ?? "";
const before = process.env.KEEL_POSTGRES_URL;
afterAll(() => {
  if (before === undefined) Reflect.deleteProperty(process.env, "KEEL_POSTGRES_URL");
  else process.env.KEEL_POSTGRES_URL = before;
});

/** The data lines of an event stream, one parsed event per `next()`; `null` once it ends. */
function events(res: Response) {
  const body = res.body;
  if (body === null) throw new Error("the stream has no body");
  const reader = body.getReader();
  const text = new TextDecoder();
  let buffered = "";
  const next = async (): Promise<unknown> => {
    for (;;) {
      const line = buffered.split("\n").find((l) => l.startsWith("data:"));
      if (line !== undefined) {
        buffered = buffered.slice(buffered.indexOf(line) + line.length + 1);
        return JSON.parse(line.slice(5));
      }
      const chunk = await reader.read();
      if (chunk.done) return null;
      buffered += text.decode(chunk.value);
    }
  };
  return { next, close: () => reader.cancel() };
}

describe.skipIf(PG17 === "")("on Postgres 17", () => {
  it("delivers a member's add on one replica to a stream open on the other", async () => {
    process.env.KEEL_POSTGRES_URL = PG17;
    const one = createCtx({ mode: "real", seed: 21 });
    // The replicas share Keel storage, as a balanced deployment does, and with it the sign-in library's sessions.
    const two = createCtx({ mode: "real", seed: 22, drivers: { storage: one.storage } });
    const replica = (ctx: typeof one) =>
      createApp({ topology, routes: webRoutes, ctx, deployable: "web", identity: source });
    const [a, b] = [await replica(one), await replica(two)];
    const tag = randomBytes(4).toString("hex");
    const cookie = await signIn((r) => a.fetch(r), `ada.${tag}@example.com`);
    expect(cookie).not.toBe("");
    const res = await b.fetch(
      new Request("http://localhost/api/items/events", { headers: { accept: "text/event-stream", cookie } }),
    );
    const st = events(res);
    expect(await st.next()).toEqual({ ok: true, value: { kind: "reset" } });
    const name = `Eggs ${tag}`;
    const added = await a.fetch(asJson("POST", "/api/items", { name }, { cookie }));
    expect(added.status).toBe(200);
    expect(await st.next()).toEqual({ ok: true, value: { kind: "changed" } });
    const listed = await (await b.fetch(asJson("GET", "/api/items", undefined, { cookie }))).json();
    expect(listed.results["shopping.items"].value.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ name })]),
    );
    await st.close();
  });
});
