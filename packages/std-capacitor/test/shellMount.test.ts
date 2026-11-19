// @vitest-environment happy-dom
// k.return on a Capacitor shell: `shellMount` opens the external browser through `@capacitor/browser` on KEEL_ORIGIN,
// takes the launch link and each `appUrlOpen` as a return link, closes the browser, and takes the launch link once.
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
function start(launch?: string) {
  native.launch = launch === undefined ? undefined : { url: launch };
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const sent: string[] = [];
  ctx.net.route("*", async (req) => {
    const u = new URL(req.url);
    sent.push(`${u.pathname}${u.search}`);
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

test("a return link while running closes the browser, sends its mount request, and a GET that ends opens KEEL_ORIGIN", async () => {
  const t = start();
  await settle();
  t.link("dev.keel.app:/api/auth/callback?code=c");
  await settle();
  expect(t.sent).toEqual(["/api/auth/callback?code=c"]);
  expect(native.closed).toBe(1);
  expect(native.opened).toEqual(["https://golden.example/api/auth/callback?code=c"]);
});

test("the launch link is taken once, whether or not appUrlOpen repeats it; later links are all taken", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.boolean(),
      fc.array(fc.stringMatching(/^[a-z]{1,5}$/), { maxLength: 4 }),
      async (repeats, later) => {
        native.listeners.length = 0;
        const launch = "dev.keel.app:/api/auth/launch";
        const t = start(launch);
        await settle();
        if (repeats) t.link(launch);
        for (const p of later) t.link(`dev.keel.app:/api/auth/${p}`);
        await settle();
        expect(t.sent).toEqual(["/api/auth/launch", ...later.map((p) => `/api/auth/${p}`)]);
      },
    ),
    { seed: 1337, numRuns: 30 },
  );
});

test("with no launch link nothing is sent until a link arrives, and a link on another scheme is ignored", async () => {
  const t = start();
  await settle();
  t.link("dev.keel.other:/api/auth/callback");
  await settle();
  expect(t.sent).toEqual([]);
});
