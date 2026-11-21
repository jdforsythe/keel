// @vitest-environment happy-dom
// k.links Launch and the declared paths on the intake of a shell's ctx (`mountRequests`), where conformance does not
// reach: a held opening's deadline, a second report, the order of launch links, and declared paths under two mounts.
// A page's chain is started through the ctx's shell hook (`shells`), as a router's navigation to the mount is. Seed 1337.
import { type SimCtx, createCtx } from "@keel/ctx";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { identityMount } from "../src/identityMount.ts";
import { mountRequests } from "../src/internal/mountRequests.ts";
import { personActs } from "../src/internal/personActs.ts";
import { shells } from "../src/internal/shells.ts";

const MOUNTS = [identityMount("/la", { links: ["/verify", "/v/two"] }), identityMount("/lb", { links: ["/x"] })];
const KEY = "keel.return";
const ID = "dev.keel.la";
const PROVIDER = "https://provider.example/a";
const settle = async (): Promise<void> => {
  for (let i = 0; i < 100; i++) await Promise.resolve();
};

/** A shell on a fresh sim ctx: `/la/start` answers 302 to the provider (an opening), every other GET 404. */
function shell() {
  const ctx: SimCtx = createCtx({ mode: "sim", seed: 1337 });
  const sent: string[] = [];
  const opened: string[] = [];
  ctx.net.route("*", async (req) => {
    const u = new URL(req.url);
    sent.push(`${u.pathname}${u.search}`);
    return u.pathname === "/la/start"
      ? new Response(null, { status: 302, headers: { location: PROVIDER } })
      : new Response(null, { status: 404 });
  });
  const { link, launch } = mountRequests(ctx, { id: ID, open: (u) => void opened.push(u), mounts: MOUNTS });
  const start = async (): Promise<void> => {
    shells.get(ctx)?.("/la/start");
    await settle();
  };
  const callbacks = (): number => sent.filter((u) => u === "/la/cb").length;
  const callback = async (): Promise<void> => {
    await link(`${ID}:/la/cb`);
    await settle();
  };
  return { ctx, sent, opened, link, launch, start, callback, callbacks };
}

describe("the launch report (k.links Launch)", () => {
  it("an opening before the report is held: the browser opens, nothing is stored", async () => {
    const t = shell();
    await t.start();
    expect(t.opened).toEqual([PROVIDER]);
    expect(await t.ctx.storage.get(KEY)).toBeNull();
  });

  it("a report of no link records the last held opening with its deadline 600000 ms after it opened", async () => {
    const t = shell();
    await t.start();
    await t.ctx.clock.advance(1000);
    await t.start();
    await t.ctx.clock.advance(5000);
    await t.launch([]);
    expect(await t.ctx.storage.get(KEY)).toBe(JSON.stringify({ deadline: 601000 }));
  });

  it("a launch link that does not parse is ignored and the later links are delivered in order", async () => {
    const t = shell();
    await t.launch([`${ID}://[`, `${ID}:/\\[`, `${ID}:/la/verify?n=2`]);
    await settle();
    expect(t.sent).toEqual(["/la/verify?n=2"]);
  });

  it("a report of no link with nothing held stores nothing", async () => {
    const t = shell();
    await t.launch([]);
    expect(await t.ctx.storage.get(KEY)).toBeNull();
  });

  it("an opening after a person's act is recorded before the report, and the report does not replace it", async () => {
    const t = shell();
    await t.start();
    await t.ctx.clock.advance(1000);
    personActs.fired(t.ctx, { type: "click" });
    await t.start();
    await t.launch([]);
    expect(await t.ctx.storage.get(KEY)).toBe(JSON.stringify({ deadline: 601000 }));
  });

  it("a report of a failed read or of links drops the held opening; links are delivered in order", async () => {
    const failed = shell();
    await failed.start();
    await failed.launch(null);
    await failed.callback();
    expect(failed.callbacks()).toBe(0);
    const linked = shell();
    await linked.start();
    await linked.launch([`${ID}:/la/verify?n=1`, `${ID}:/la/cb`, `${ID}:/lb/x?n=2`]);
    await settle();
    expect(linked.sent).toEqual(["/la/start", "/la/verify?n=1", "/lb/x?n=2"]);
  });

  it("a report of links or of a failed read makes the ctx link-started until an act, a link taken or not", async () => {
    const reports: readonly (readonly string[] | null)[] = [
      null,
      [`${ID}:/la/cb`],
      [`${ID}:/elsewhere`],
      [`${ID}:/la/verify`],
      ["https://evil.example/la/cb"],
    ];
    for (const report of reports) {
      const t = shell();
      await t.launch(report);
      await settle();
      await t.start();
      await t.callback();
      expect(t.callbacks(), JSON.stringify(report)).toBe(0);
      expect(await t.ctx.storage.get(KEY), JSON.stringify(report)).toBeNull();
      personActs.fired(t.ctx, { type: "click" });
      await t.start();
      await t.callback();
      expect(t.callbacks(), JSON.stringify(report)).toBe(1);
    }
  });

  it("a mount request in flight when a report of links or a failed read arrives records no opening", async () => {
    for (const report of [null, [`${ID}:/elsewhere`], []]) {
      let answer = (): void => undefined;
      const gate = new Promise<void>((resolve) => {
        answer = resolve;
      });
      const slow = createCtx({ mode: "sim", seed: 1337 });
      const sent: string[] = [];
      slow.net.route("*", async (req) => {
        const u = new URL(req.url);
        sent.push(u.pathname);
        if (u.pathname !== "/la/start") return new Response(null, { status: 404 });
        await gate;
        return new Response(null, { status: 302, headers: { location: PROVIDER } });
      });
      const opened: string[] = [];
      const intake = mountRequests(slow, { id: ID, open: (u) => void opened.push(u), mounts: MOUNTS });
      shells.get(slow)?.("/la/start");
      await settle();
      await intake.launch(report);
      answer();
      await settle();
      expect(opened, JSON.stringify(report)).toEqual([PROVIDER]);
      await intake.link(`${ID}:/la/cb`);
      await settle();
      expect(
        sent.filter((u) => u === "/la/cb"),
        JSON.stringify(report),
      ).toHaveLength(report?.length === 0 ? 1 : 0);
    }
  });

  it("only the first report counts: any later one stores, drops and delivers nothing", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<readonly string[] | null>([], null, [`${ID}:/la/verify`]),
        fc.constantFrom<readonly string[] | null>([], null, [`${ID}:/la/verify`]),
        async (first, second) => {
          const t = shell();
          await t.launch(first);
          await settle();
          // A report of links or a failed read makes the ctx link-started; an act ends that, so the page's chain can record.
          if (first?.length !== 0) personActs.fired(t.ctx, { type: "click" });
          const before = t.sent.length;
          await t.start();
          await t.launch(second);
          await settle();
          // After the first report an opening is recorded at once; the second report neither drops it nor delivers.
          expect(t.sent.length - before).toBe(1);
          await t.callback();
          expect(t.callbacks()).toBe(1);
        },
      ),
      { seed: 1337, numRuns: 9 },
    );
  });

  it("a shell that never reports records no opening before a person's act", async () => {
    const t = shell();
    await t.start();
    await t.ctx.clock.advance(1);
    await t.callback();
    expect(t.callbacks()).toBe(0);
    personActs.fired(t.ctx, { type: "click" });
    await t.start();
    await t.callback();
    expect(t.callbacks()).toBe(1);
  });
});

describe("declared paths (k.links Return links)", () => {
  it("a declared path of either mount takes one GET at any time, its search passed on, and takes no opening", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("/la/verify", "/la/v/two", "/lb/x"),
        fc.stringMatching(/^[a-z0-9]{1,5}=[a-z0-9]{0,5}$/),
        async (path, q) => {
          const t = shell();
          await t.launch([]);
          personActs.fired(t.ctx, { type: "click" });
          await t.start();
          await t.link(`${ID}:${path}?${q}`);
          await settle();
          expect(t.sent).toEqual(["/la/start", `${path}?${q}`]);
          // The opening is still pending; the link made the ctx link-started.
          expect(personActs.of(t.ctx).linked).toBe(true);
          await t.callback();
          expect(t.callbacks()).toBe(1);
        },
      ),
      { seed: 1337, numRuns: 20 },
    );
  });

  it("a path that only resembles a declared one needs an opening", async () => {
    for (const path of ["/la/verify/", "/la/Verify", "/la/v", "/la/v/two/x", "/lb/verify", "/la/x"]) {
      const t = shell();
      await t.launch([]);
      await t.link(`${ID}:${path}`);
      await settle();
      expect(t.sent, path).toEqual([]);
    }
  });

  it("a link-started ctx records no opening for the page's chain until a person acts", async () => {
    const t = shell();
    await t.launch([]);
    await t.link(`${ID}:/la/verify`);
    await t.start();
    await t.callback();
    expect(t.callbacks()).toBe(0);
    personActs.fired(t.ctx, { type: "click" });
    await t.start();
    await t.callback();
    expect(t.callbacks()).toBe(1);
  });
});

describe("the mounts a shell is given", () => {
  it("only the mounts passed to it route: another mount made in this process sends nothing", async () => {
    const ctx: SimCtx = createCtx({ mode: "sim", seed: 1337 });
    const sent: string[] = [];
    ctx.net.route("*", async (req) => {
      sent.push(new URL(req.url).pathname);
      return new Response(null, { status: 404 });
    });
    const only = MOUNTS.slice(0, 1);
    const { link, launch } = mountRequests(ctx, { id: ID, open: () => undefined, mounts: only });
    await launch([]);
    expect(shells.get(ctx)?.("/lb/start")).toBe(false);
    await link(`${ID}:/lb/x`);
    await link(`${ID}:/la/verify`);
    await settle();
    expect(sent).toEqual(["/la/verify"]);
  });
});
