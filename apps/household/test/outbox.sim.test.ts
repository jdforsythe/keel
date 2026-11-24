import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { drain, send } from "@keel/std-offline";
import { NoRows, sql } from "@keel/std-postgres";
import { simulate } from "@keel/testing";
import { afterEach, expect, it } from "vitest";
import mount from "../identity.ts";
import { Items } from "../modules/shopping/Items.schema.ts";
import { listOutbox } from "../modules/shopping/listOutbox.ts";
import { shoppingDb } from "../modules/shopping/shoppingDb.server.ts";
import { GRACE, household } from "./household.ts";
import { PASSWORD, asJson, formPost } from "./serve.ts";

const Count = s.object({ n: s.int() });
type House = Awaited<ReturnType<typeof household>>;

const empty = listOutbox.snapshot();
afterEach(() => {
  expect(listOutbox.restore(empty).ok).toBe(true);
});

/** The list as the server holds it, read as Ada. */
async function stored(h: House) {
  const res = await h.raw(asJson("GET", "/api/items", undefined, { cookie: h.adaCookie }));
  const list = Items.parse((await res.json()).results["shopping.items"].value);
  if (!list.ok) throw new Error("the list does not parse");
  return list.value.items;
}

/**
 * An empty list and no kept write key, for the next run. A sim ctx draws its write keys from its seed, and two runs of
 * one seed draw the same key; a browser draws a fresh one for every write.
 */
async function startOver(h: House): Promise<void> {
  const items = await shoppingDb(h.ctx).run(sql(NoRows)`delete from items`);
  const keys = await shoppingDb(h.ctx).run(sql(NoRows)`delete from list_writes`);
  if (!items.ok || !keys.ok) throw new Error("the list was not cleared");
}

/** How many outbox writes the server has committed. */
async function committed(h: House): Promise<number> {
  const rows = await shoppingDb(h.ctx).query(sql(Count)`select count(*)::int as n from list_writes`);
  return rows.ok ? (rows.value[0]?.n ?? -1) : -1;
}

/** Ada adds `name` through the API: a new item, or one more of an item still to buy. */
const adaAdds = (h: House, name: string) => h.raw(asJson("POST", "/api/items", { name }, { cookie: h.adaCookie }));

/** Requests of Grace's browser reach the one server with the cookie `jar` holds now. */
const toServer = (h: House, jar: { cookie: string }) => (req: Request) => {
  const url = new URL(req.url);
  const headers = new Headers(req.headers);
  if (jar.cookie !== "") headers.set("cookie", jar.cookie);
  return h.raw(
    new Request(`http://localhost${url.pathname}${url.search}`, {
      method: req.method,
      headers,
      signal: req.signal,
      ...(req.method === "GET" ? {} : { body: req.body, duplex: "half" }),
    }),
  );
};

const waiting = () => listOutbox.get("entries").some((e) => e.state === "queued" || e.state === "sending");

/**
 * Grace marks an item bought with her browser offline; Ada, at home, adds one more of it. In odd runs Ada's change
 * lands before Grace's browser is back, in even runs after her mark went. Under each generated schedule of drops,
 * delays, lost responses, 503s, storage failures and offline windows: the mark commits once or not at all, never
 * twice; when Ada was first the server refuses it with 409 `keel.conflict` and the entry stays for Grace to settle,
 * with the item's revision as its head; when Grace was first and the entry is gone, the item is bought.
 */
it("commits an offline mark once, or keeps it as a conflict when another member changed the item first", async () => {
  const h = await household(31);
  const jar = { cookie: h.graceCookie };
  const outcomes = { sent: 0, conflict: 0, failed: 0 };
  let n = 0;
  await simulate(
    async ({ ctx, run }) => {
      expect(listOutbox.restore(empty).ok).toBe(true);
      await startOver(h);
      n += 1;
      const name = `Item ${n}`;
      const adaFirst = n % 2 === 1;
      await adaAdds(h, name);
      const item = (await stored(h)).find((i) => i.name === name);
      if (item === undefined) throw new Error(`no ${name} on the list`);
      const before = await committed(h);
      ctx.net.route(`${location.origin}/*`, toServer(h, jar));
      const page = scope(() => undefined);
      page.run(() => void drain(ctx, listOutbox, { owner: h.graceId }));

      ctx.net.setOnline(false);
      const first = await send(
        ctx,
        listOutbox,
        "mark",
        { params: { id: item.id }, body: { bought: true } },
        { base: item.rev, owner: h.graceId },
      );
      expect(["queued", "failed"]).toContain(first.state);
      if (adaFirst) await adaAdds(h, name);
      ctx.net.setOnline(true);
      await run();
      ctx.net.setOnline(true);
      // The server is a household of its own, on a ctx the run does not drive: each turn waits for one round trip to
      // it and moves the browser's clock past the outbox's longest retry gap.
      for (let turn = 0; turn < 40 && waiting(); turn++) {
        await stored(h);
        ctx.clock.advance(60_000);
        ctx.net.setOnline(true);
        await run();
      }
      if (!adaFirst) await adaAdds(h, name);
      page.dispose();

      const [entry] = listOutbox.get("entries");
      const applied = (await committed(h)) - before;
      const now = (await stored(h)).find((i) => i.id === item.id);
      expect(waiting()).toBe(false);
      expect([0, 1]).toContain(applied);
      expect(now?.bought).toBe(applied === 1);
      if (adaFirst) {
        expect(applied).toBe(0);
        expect(now).toMatchObject({ qty: 2, rev: 1 });
        expect(["conflict", "failed"]).toContain(entry?.state);
        if (entry?.state === "conflict") expect(entry.head).toBe(1);
      } else {
        expect(now).toMatchObject(applied === 1 ? { qty: 1, rev: 1 } : { qty: 2, rev: 1 });
        if (entry === undefined) expect(applied).toBe(1);
        else expect(entry.state).toBe("failed");
      }
      outcomes[entry === undefined ? "sent" : entry.state === "conflict" ? "conflict" : "failed"] += 1;
    },
    { runs: 30, seed: 9, horizon: 120_000 },
  );
  expect(outcomes.sent).toBeGreaterThan(0);
  expect(outcomes.conflict).toBeGreaterThan(0);
}, 240_000);

/**
 * Grace marks an item bought offline, then signs out before her browser is back. Under each generated schedule the
 * server commits nothing while no one is signed in and the mark stays in her outbox; once she signs in again and the
 * list page drains for her, the mark commits once.
 */
it("holds a queued mark through a sign-out and sends it once the same member signs in again", async () => {
  const h = await household(32);
  let n = 0;
  await simulate(
    async ({ ctx, run }) => {
      expect(listOutbox.restore(empty).ok).toBe(true);
      await startOver(h);
      n += 1;
      const name = `Staple ${n}`;
      await adaAdds(h, name);
      const item = (await stored(h)).find((i) => i.name === name);
      if (item === undefined) throw new Error(`no ${name} on the list`);
      const before = await committed(h);
      const signIn = await h.raw(formPost(mount.href("/sign-in/email"), { email: GRACE, password: PASSWORD }));
      const cookieOf = (res: Response) =>
        res.headers
          .getSetCookie()
          .map((c) => c.split(";")[0] ?? "")
          .filter((c) => !c.endsWith("="))
          .join("; ");
      const jar = { cookie: cookieOf(signIn) };
      ctx.net.route(`${location.origin}/*`, toServer(h, jar));
      const page = scope(() => undefined);
      page.run(() => void drain(ctx, listOutbox, { owner: h.graceId }));
      ctx.net.setOnline(false);
      const first = await send(
        ctx,
        listOutbox,
        "mark",
        { params: { id: item.id }, body: { bought: true } },
        { base: item.rev, owner: h.graceId },
      );
      if (first.state !== "queued") {
        // The schedule failed the browser's storage: nothing is queued, so nothing may commit.
        page.dispose();
        expect(first.state).toBe("failed");
        return;
      }

      await h.raw(formPost(mount.href("/sign-out"), {}, jar.cookie));
      ctx.net.setOnline(true);
      await run();
      ctx.net.setOnline(true);
      // Six turns, and more while a flush is still in hand (its storage write waits on the clock).
      const sending = () => listOutbox.get("entries").some((e) => e.state === "sending");
      for (let turn = 0; turn < 6 || (turn < 20 && sending()); turn++) {
        await stored(h);
        ctx.clock.advance(60_000);
        ctx.net.setOnline(true);
        await run();
      }
      expect((await committed(h)) - before).toBe(0);
      expect((await stored(h)).find((i) => i.id === item.id)).toMatchObject({ bought: false, rev: 0 });
      const held = listOutbox.get("entries");
      expect(held.map((e) => e.endpoint)).toEqual(["mark"]);
      page.dispose();
      if (held[0]?.state !== "queued") {
        expect(held[0]?.state).toBe("failed");
        return;
      }

      // She signs in again; the list page she opens drains for her.
      jar.cookie = cookieOf(await h.raw(formPost(mount.href("/sign-in/email"), { email: GRACE, password: PASSWORD })));
      const again = scope(() => undefined);
      again.run(() => void drain(ctx, listOutbox, { owner: h.graceId }));
      for (let turn = 0; turn < 40 && waiting(); turn++) {
        await stored(h);
        ctx.clock.advance(60_000);
        ctx.net.setOnline(true);
        await run();
      }
      again.dispose();
      const applied = (await committed(h)) - before;
      const [entry] = listOutbox.get("entries");
      expect([0, 1]).toContain(applied);
      expect((await stored(h)).find((i) => i.id === item.id)?.bought).toBe(applied === 1);
      if (entry === undefined) expect(applied).toBe(1);
      else expect(entry.state).toBe("failed");
    },
    { runs: 15, seed: 10, horizon: 120_000 },
  );
}, 240_000);
