// @vitest-environment happy-dom
// k.return on a Capacitor shell: `shellMount` opens the external browser through `@capacitor/browser` on KEEL_ORIGIN,
// hands the launch link and each `appUrlOpen` to the router's intake, which admits one per pending opening (the
// opening kept in `ctx.storage` `keel.return`, so one recorded before a relaunch admits the launch link); a link
// admitted closes the browser; the launch link is handed over once.
// The plugins are stood in for; a sim ctx's net answers the mount requests. Seed 1337 for the property.
import { createCtx } from "@keel/ctx";
import { identityMount } from "@keel/router";
import fc from "fast-check";
import { beforeEach, expect, test, vi } from "vitest";
import { shellMount } from "../src/shellMount.ts";

const native = vi.hoisted(() => {
  const state: {
    launch: { url: string } | undefined;
    listeners: ((e: { url: string }) => void)[];
    opened: string[];
    closed: number;
  } = { launch: undefined, listeners: [], opened: [], closed: 0 };
  return state;
});
vi.mock("@capacitor/app", () => ({
  App: {
    getLaunchUrl: async () => native.launch,
    addListener: async (_name: string, f: (e: { url: string }) => void) => {
      native.listeners.push(f);
      return { remove: async () => undefined };
    },
  },
}));
vi.mock("@capacitor/browser", () => ({
  Browser: {
    open: async (o: { url: string }) => void native.opened.push(o.url),
    close: async () => {
      native.closed += 1;
      throw new Error("not implemented on android");
    },
  },
}));

identityMount("/api/auth");
const ORIGIN = new URL("https://golden.example");
const settle = async (): Promise<void> => {
  for (let i = 0; i < 100; i++) await Promise.resolve();
};
/** A shell on a sim ctx; `pending` stores an opening first, as one a mount request made before a relaunch; `ends`
 * answers each request 200 (a GET that ends opens the browser, a new opening), else the request fails. */
async function start(opts: { launch?: string; pending?: boolean; ends?: boolean } = {}) {
  native.launch = opts.launch === undefined ? undefined : { url: opts.launch };
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  if (opts.pending === true) await ctx.storage.set("keel.return", JSON.stringify({ deadline: 600000 }));
  const sent: string[] = [];
  ctx.net.route("*", async (req) => {
    const u = new URL(req.url);
    sent.push(`${u.pathname}${u.search}`);
    if (opts.ends !== true) throw new TypeError("offline");
    return new Response("");
  });
  shellMount(ctx, { id: "dev.keel.app", origin: ORIGIN });
  return { sent, link: (url: string) => native.listeners.at(-1)?.({ url }) };
}

beforeEach(() => {
  native.listeners.length = 0;
  native.opened.length = 0;
  native.closed = 0;
});

test("a return link while an opening is pending closes the browser, sends its mount request, and a GET that ends opens KEEL_ORIGIN", async () => {
  const t = await start({ pending: true, ends: true });
  await settle();
  t.link("dev.keel.app:/api/auth/callback?code=c");
  await settle();
  expect(t.sent).toEqual(["/api/auth/callback?code=c"]);
  expect(native.closed).toBe(1);
  expect(native.opened).toEqual(["https://golden.example/api/auth/callback?code=c"]);
});

test("with no opening pending a return link sends nothing, opens nothing and closes nothing", async () => {
  const t = await start({ ends: true });
  await settle();
  t.link("dev.keel.app:/api/auth/callback?code=c");
  await settle();
  expect(t.sent).toEqual([]);
  expect(native.closed).toBe(0);
  expect(native.opened).toEqual([]);
});

test("a cold start's launch link takes the stored opening once, whether or not appUrlOpen repeats it; later links find none", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.boolean(),
      fc.array(fc.stringMatching(/^[a-z]{1,5}$/), { maxLength: 4 }),
      async (repeats, later) => {
        native.listeners.length = 0;
        const launch = "dev.keel.app:/api/auth/launch";
        const t = await start({ launch, pending: true });
        await settle();
        if (repeats) t.link(launch);
        for (const p of later) t.link(`dev.keel.app:/api/auth/${p}`);
        await settle();
        expect(t.sent).toEqual(["/api/auth/launch"]);
      },
    ),
    { seed: 1337, numRuns: 30 },
  );
});

test("a link on another scheme is ignored and leaves the opening for the next return link", async () => {
  const t = await start({ pending: true });
  await settle();
  t.link("dev.keel.other:/api/auth/callback");
  await settle();
  expect(t.sent).toEqual([]);
  t.link("dev.keel.app:/api/auth/callback");
  await settle();
  expect(t.sent).toEqual(["/api/auth/callback"]);
});
