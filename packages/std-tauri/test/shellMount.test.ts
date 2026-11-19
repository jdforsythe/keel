// @vitest-environment happy-dom
// k.return on a Tauri shell: `shellMount` opens the default browser through `@tauri-apps/plugin-opener` on
// KEEL_ORIGIN and takes the launch links and each `onOpenUrl` batch as return links, the launch links once.
// The plugins are stood in for; a sim ctx's net answers the mount requests. Seed 1337 for the property.
import { createCtx } from "@keel/ctx";
import { identityMount } from "@keel/router";
import fc from "fast-check";
import { beforeEach, expect, test, vi } from "vitest";
import { shellMount } from "../src/shellMount.ts";

const native = vi.hoisted(() => {
  const state: { launch: string[] | null; listeners: ((urls: string[]) => void)[]; opened: string[] } = {
    launch: null,
    listeners: [],
    opened: [],
  };
  return state;
});
vi.mock("@tauri-apps/plugin-deep-link", () => ({
  getCurrent: async () => native.launch,
  onOpenUrl: async (f: (urls: string[]) => void) => {
    native.listeners.push(f);
    return () => undefined;
  },
}));
vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: async (url: string) => void native.opened.push(url),
}));

identityMount("/api/auth");
const ORIGIN = new URL("https://golden.example");
const settle = async (): Promise<void> => {
  for (let i = 0; i < 100; i++) await Promise.resolve();
};
function start(launch: string[] | null = null) {
  native.launch = launch;
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const sent: string[] = [];
  ctx.net.route("*", async (req) => {
    const u = new URL(req.url);
    sent.push(`${u.pathname}${u.search}`);
    return u.pathname.endsWith("/start")
      ? new Response(null, { status: 302, headers: { location: "https://provider.example/a" } })
      : new Response("");
  });
  shellMount(ctx, { id: "dev.keel.app", origin: ORIGIN });
  return { sent, link: (...urls: string[]) => native.listeners.at(-1)?.(urls) };
}

beforeEach(() => {
  native.listeners.length = 0;
  native.opened.length = 0;
});

test("a return link sends its mount request; a provider redirect and a GET that ends open in the default browser", async () => {
  const t = start();
  await settle();
  t.link("dev.keel.app:/api/auth/start", "dev.keel.app:/api/auth/callback?code=c");
  await settle();
  expect(t.sent).toEqual(["/api/auth/start", "/api/auth/callback?code=c"]);
  expect(native.opened).toEqual(["https://provider.example/a", "https://golden.example/api/auth/callback?code=c"]);
});

test("the launch links are taken once, whether or not onOpenUrl repeats them; later links are all taken", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.boolean(),
      fc.array(fc.stringMatching(/^[a-z]{1,5}$/), { maxLength: 4 }),
      async (repeats, later) => {
        native.listeners.length = 0;
        const launch = ["dev.keel.app:/api/auth/launch"];
        const t = start(launch);
        await settle();
        if (repeats) t.link(...launch);
        for (const p of later) t.link(`dev.keel.app:/api/auth/${p}`);
        await settle();
        expect(t.sent).toEqual(["/api/auth/launch", ...later.map((p) => `/api/auth/${p}`)]);
      },
    ),
    { seed: 1337, numRuns: 30 },
  );
});

test("with no launch link nothing is sent, and a link on another scheme is ignored", async () => {
  const t = start();
  await settle();
  t.link("dev.keel.other:/api/auth/callback");
  await settle();
  expect(t.sent).toEqual([]);
});
