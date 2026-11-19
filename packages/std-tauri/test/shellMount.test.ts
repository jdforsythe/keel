// @vitest-environment happy-dom
// k.return on a Tauri shell: `shellMount` opens the default browser through `@tauri-apps/plugin-opener` on
// KEEL_ORIGIN and hands the launch links and each `onOpenUrl` batch to the router's intake, the launch links once;
// the intake admits one link per pending opening (kept in `ctx.storage` `keel.return`, so one recorded before a
// relaunch admits a launch link).
// The plugins are stood in for; a sim ctx's net answers the mount requests. Seed 1337 for the property.
import { createCtx } from "@keel/ctx";
import { identityMount } from "@keel/router";
import fc from "fast-check";
import { beforeEach, expect, test, vi } from "vitest";
import { shellMount } from "../src/shellMount.ts";

const native = vi.hoisted(() => {
  const state: {
    launch: string[] | null;
    fails: boolean;
    listeners: ((urls: string[]) => void)[];
    opened: string[];
  } = {
    launch: null,
    fails: false,
    listeners: [],
    opened: [],
  };
  return state;
});
vi.mock("@tauri-apps/plugin-deep-link", () => ({
  getCurrent: async () => {
    if (native.fails) throw new Error("no launch urls");
    return native.launch;
  },
  onOpenUrl: async (f: (urls: string[]) => void) => {
    native.listeners.push(f);
    return () => undefined;
  },
}));
/** Each launch report the shell makes to the router's intake, in order (k.links Launch). */
const reports = vi.hoisted((): (readonly string[] | null)[] => []);
vi.mock("@keel/router/internal", async (importOriginal) => {
  const real = await importOriginal<typeof import("@keel/router/internal")>();
  return {
    ...real,
    mountRequests: (...args: Parameters<typeof real.mountRequests>) => {
      const intake = real.mountRequests(...args);
      return {
        ...intake,
        launch: (links: readonly string[] | null) => {
          reports.push(links);
          return intake.launch(links);
        },
      };
    },
  };
});
vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: async (url: string) => void native.opened.push(url),
}));

identityMount("/api/auth");
const ORIGIN = new URL("https://golden.example");
const settle = async (): Promise<void> => {
  for (let i = 0; i < 100; i++) await Promise.resolve();
};
/** A shell on a sim ctx; `pending` stores an opening first, as one a mount request made before a relaunch. A request
 * for `/start` is answered 302 to a provider (an opening), `/fail` fails, anything else 200. */
async function start(opts: { launch?: string[]; pending?: boolean } = {}) {
  native.launch = opts.launch ?? null;
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  if (opts.pending === true) await ctx.storage.set("keel.return", JSON.stringify({ deadline: 600000 }));
  const sent: string[] = [];
  ctx.net.route("*", async (req) => {
    const u = new URL(req.url);
    sent.push(`${u.pathname}${u.search}`);
    if (u.pathname.startsWith("/api/auth/fail")) throw new TypeError("offline");
    return u.pathname.endsWith("/start")
      ? new Response(null, { status: 302, headers: { location: "https://provider.example/a" } })
      : new Response("");
  });
  shellMount(ctx, { id: "dev.keel.app", origin: ORIGIN });
  return { sent, link: (...urls: string[]) => native.listeners.at(-1)?.(urls) };
}

beforeEach(() => {
  native.fails = false;
  reports.length = 0;
  native.listeners.length = 0;
  native.opened.length = 0;
});

test("an admitted return link sends its mount request; its provider redirect opens in the default browser and records no opening, so the next link sends nothing", async () => {
  const t = await start({ pending: true });
  await settle();
  t.link("dev.keel.app:/api/auth/start");
  await settle();
  t.link("dev.keel.app:/api/auth/callback?code=c");
  await settle();
  expect(t.sent).toEqual(["/api/auth/start"]);
  expect(native.opened).toEqual(["https://provider.example/a"]);
});

test("links delivered in one batch share one opening: the first is admitted, the rest are ignored", async () => {
  const t = await start({ pending: true });
  await settle();
  t.link("dev.keel.app:/api/auth/start", "dev.keel.app:/api/auth/callback?code=c");
  await settle();
  expect(t.sent).toEqual(["/api/auth/start"]);
});

test("a cold start's launch links take the stored opening once, whether or not onOpenUrl repeats them; later links find none", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.boolean(),
      fc.array(fc.stringMatching(/^[a-z]{1,5}$/), { maxLength: 4 }),
      async (repeats, later) => {
        native.listeners.length = 0;
        const launch = ["dev.keel.app:/api/auth/fail"];
        const t = await start({ launch, pending: true });
        await settle();
        if (repeats) t.link(...launch);
        for (const p of later) t.link(`dev.keel.app:/api/auth/${p}`);
        await settle();
        expect(t.sent).toEqual(["/api/auth/fail"]);
      },
    ),
    { seed: 1337, numRuns: 30 },
  );
});

test("with no opening nothing is sent, and a link on another scheme is ignored", async () => {
  const t = await start();
  await settle();
  t.link("dev.keel.app:/api/auth/callback");
  t.link("dev.keel.other:/api/auth/callback");
  await settle();
  expect(t.sent).toEqual([]);
});

test("the launch is reported once as getCurrent settles: its URLs, null as no link, or a failed read; onOpenUrl is listened for after it", async () => {
  for (const [launch, fails, expected] of [
    [["dev.keel.app:/api/auth/a", "dev.keel.app:/b"], false, ["dev.keel.app:/api/auth/a", "dev.keel.app:/b"]],
    [undefined, false, []],
    [undefined, true, null],
  ] as const) {
    reports.length = 0;
    native.listeners.length = 0;
    native.fails = fails;
    await start(launch === undefined ? {} : { launch: [...launch] });
    expect(native.listeners).toHaveLength(0);
    await settle();
    expect(reports).toEqual([expected]);
    expect(native.listeners).toHaveLength(1);
  }
});
