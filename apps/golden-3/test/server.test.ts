// @vitest-environment node
import { type Ctx, createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { createApp } from "@keel/server";
import { cspPolicy } from "@keel/server/csp";
import { expect, test } from "vitest";
import { Board } from "../modules/shifts/Board.schema.ts";
import { markAttended } from "../modules/shifts/markAttended.server.ts";
import topology from "../topology.ts";
import { webRoutes } from "./webRoutes.ts";

const origin = "http://localhost";

const sixHeaders = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), payment=(), usb=()",
};

async function start() {
  const ctx = createCtx({ mode: "sim", seed: 1 });
  const lines: string[] = [];
  const app = await createApp({
    topology,
    routes: webRoutes,
    ctx,
    deployable: "web",
    log: { format: "json", write: (line) => void lines.push(line) },
  });
  return { ctx, app, lines };
}

const saved = async (ctx: Ctx) => {
  const raw = await ctx.storage.get("keel.store.shifts.board");
  const parsed = s.object({ state: Board }).parse(raw === null ? null : JSON.parse(raw));
  return parsed.ok ? parsed.value.state : { shifts: [], signups: [] };
};

const draft = (name: string) =>
  new URLSearchParams({ name, email: "volunteer@example.org", phone: "555 0100", needs: "Quiet corner" });
const cookieOf = (r: Response) => (r.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

type Started = Awaited<ReturnType<typeof start>>;

/** Sign up for `shiftId` as a new browser; answers its cookie. */
async function signUpAs({ app }: Started, shiftId: string, name: string) {
  const r = await app.fetch(new Request(`${origin}/shifts/${shiftId}`, { method: "POST", body: draft(name) }));
  expect(r.status).toBe(303);
  expect(r.headers.get("location")).toBe("/mine");
  return cookieOf(r);
}

test("every page document carries the policy with a fresh nonce and the six headers", async () => {
  const started = await start();
  const { app, ctx } = started;
  const cookie = await signUpAs(started, "s1", "Ada Lovelace");
  const owner = (await saved(ctx)).signups[0];
  expect(owner).toBeDefined();
  if (owner === undefined) return;
  await ctx.storage.set("shifts.organizers", JSON.stringify([owner.owner]));
  const paths = ["/", "/shifts/s1", "/mine", `/mine/${owner.id}`, "/roster", `/roster/${owner.id}`];
  const nonces = new Set<string>();
  for (const path of paths) {
    const r = await app.fetch(new Request(`${origin}${path}`, { headers: { cookie } }));
    expect(r.status, path).toBe(200);
    const policy = r.headers.get("content-security-policy") ?? "";
    const nonce = /'nonce-([^']+)'/.exec(policy)?.[1] ?? "";
    expect(nonce, path).toHaveLength(64);
    expect(policy, path).toBe(cspPolicy({ nonce }));
    expect(r.headers.get("reporting-endpoints"), path).toBe('keel-csp="/__keel/csp"');
    expect(r.headers.get("cache-control"), path).toBe("private, no-store");
    for (const [name, value] of Object.entries(sixHeaders)) expect(r.headers.get(name), `${path} ${name}`).toBe(value);
    const html = await r.text();
    expect(html, path).toContain(`<meta property="csp-nonce" nonce="${nonce}">`);
    expect(html, path).not.toMatch(/<style|\sstyle=|\son[a-z]+=/);
    nonces.add(nonce);
  }
  expect(nonces.size).toBe(paths.length);
});

test("a non-document response carries the six headers too", async () => {
  const { app } = await start();
  const missing = await app.fetch(new Request(`${origin}/nowhere`));
  expect(missing.status).toBe(404);
  for (const [name, value] of Object.entries(sixHeaders)) expect(missing.headers.get(name), name).toBe(value);
});

test("a cancel by another caller is 404 and the owner's cancel works", async () => {
  const started = await start();
  const { app, ctx } = started;
  const a = await signUpAs(started, "s1", "Ada Lovelace");
  const b = await signUpAs(started, "s2", "Grace Hopper");
  const first = (await saved(ctx)).signups.find((x) => x.name === "Ada Lovelace");
  expect(first).toBeDefined();
  if (first === undefined) return;
  const other = await app.fetch(
    new Request(`${origin}/mine/${first.id}`, { method: "POST", body: new URLSearchParams(), headers: { cookie: b } }),
  );
  expect(other.status).toBe(404);
  expect((await saved(ctx)).signups).toHaveLength(2);
  const page = await app.fetch(new Request(`${origin}/mine/${first.id}`, { headers: { cookie: b } }));
  expect(page.status).toBe(404);
  const own = await app.fetch(
    new Request(`${origin}/mine/${first.id}`, { method: "POST", body: new URLSearchParams(), headers: { cookie: a } }),
  );
  expect(own.status).toBe(303);
  expect(own.headers.get("location")).toBe("/mine");
  expect((await saved(ctx)).signups.map((x) => x.name)).toEqual(["Grace Hopper"]);
});

test("a full shift is a conflict", async () => {
  const started = await start();
  await signUpAs(started, "s3", "One");
  await signUpAs(started, "s3", "Two");
  const third = await started.app.fetch(new Request(`${origin}/shifts/s3`, { method: "POST", body: draft("Three") }));
  expect(third.status).toBe(409);
  expect((await saved(started.ctx)).signups).toHaveLength(2);
});

test("a non-organizer's markAttended is 403, and its page redirects", async () => {
  const started = await start();
  const { app, ctx } = started;
  const cookie = await signUpAs(started, "s1", "Ada Lovelace");
  const row = (await saved(ctx)).signups[0];
  expect(row).toBeDefined();
  if (row === undefined) return;
  const denied = await markAttended.run(
    { attended: true },
    { params: { signupId: row.id }, url: `${origin}/roster/${row.id}`, caller: row.owner, user: "" },
    ctx,
  );
  expect(denied.ok).toBe(false);
  expect(denied.ok ? "" : denied.error.code).toBe("keel.denied");
  const post = await app.fetch(
    new Request(`${origin}/roster/${row.id}`, {
      method: "POST",
      body: new URLSearchParams({ attended: "on" }),
      headers: { cookie },
    }),
  );
  expect(post.status).toBe(303);
  expect(post.headers.get("location")).toBe(`/?next=${encodeURIComponent(`/roster/${row.id}`)}`);
  expect((await saved(ctx)).signups.map((x) => x.attended)).toEqual([false]);
  await ctx.storage.set("shifts.organizers", JSON.stringify([row.owner]));
  const allowed = await app.fetch(
    new Request(`${origin}/roster/${row.id}`, {
      method: "POST",
      body: new URLSearchParams({ attended: "on" }),
      headers: { cookie },
    }),
  );
  expect(allowed.status).toBe(303);
  expect(allowed.headers.get("location")).toBe("/roster");
  expect((await saved(ctx)).signups.map((x) => x.attended)).toEqual([true]);
});

test("the log holds one parseable record per request", async () => {
  const started = await start();
  await signUpAs(started, "s1", "Ada Lovelace");
  await started.app.fetch(new Request(`${origin}/`));
  const kinds = started.lines.map((line) => s.object({ kind: s.string() }).parse(JSON.parse(line)));
  expect(kinds.every((k) => k.ok)).toBe(true);
  expect(started.lines).toHaveLength(2);
});
