// k.guards: a guard returning `err` redirects to its `redirect` route with `next` and the matched route's same-name
// params. k.return: in a shell a `Form` to a `MountHref` POSTs through `ctx.net` with `redirect: 'manual'`, the
// answer's `set-cookie` is kept by the native store, and a redirect to a page the router matches is a client-side
// navigation there. A signed-out reader in the Tauri shell of `web` follows the home page's link to note n1, is sent
// to sign-in with `next`, signs in through the mount and lands on the note. The sim net here plays the native HTTP
// client, routed to the `api` deployable; the harness's cookie jar is the native store (k.return Testing).
import { createCtx } from "@keel/ctx";
import { createApp } from "@keel/server";
import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import source from "../identity.server.ts";
import { routes as api } from "../modules/api/routes.ts";
import { routes } from "../modules/notes/routes.ts";
import topology from "../topology.ts";

/** The `api` deployable over its own sim ctx, and a shell ctx whose net reaches it; `sent` lists what was sent. */
async function shell() {
  const app = await createApp({
    topology,
    routes: api,
    ctx: createCtx({ mode: "sim", seed: 1 }),
    deployable: "api",
    identity: source,
  });
  const sent: string[] = [];
  const ctx = createCtx({ mode: "sim", seed: 2 });
  ctx.net.route(new URL("/api/*", location.href).href, (req) => {
    const url = new URL(req.url);
    sent.push(`${req.method} ${url.pathname}${url.search} ${req.redirect}`);
    return app.fetch(req);
  });
  return { ctx, sent };
}

it("sends a signed-out reader to sign-in with the note as next; the sign-in posts through the mount to that next", async () => {
  const { ctx, sent } = await shell();
  const t = await renderRoute("notes.home", { routes, shell: { id: "dev.keel.shellmount" }, ctx });
  try {
    await t.fire("notes.home.toNote", { type: "click" });
    expect(t.route()).toMatchObject({ id: "notes.signin", search: { next: "/notes/n1" } });
    expect(t.find("notes.signin.title").text).toBe("Sign in");
    await t.fire("notes.signinForm:name", { type: "input", value: "Ada" });
    await t.fire("notes.signinSubmit", { type: "click" });
    expect(sent.filter((s) => s.startsWith("POST"))).toEqual([
      `POST /api/auth/sign-in/email?next=${encodeURIComponent("/notes/n1")} manual`,
    ]);
    expect(t.documents()).toEqual([]);
  } finally {
    t.dispose();
  }
});

it("sends a signed-out reader to sign-in and back to the note after signing in, the param carried", async () => {
  const { ctx, sent } = await shell();
  const t = await renderRoute("notes.home", { routes, shell: { id: "dev.keel.shellmount" }, ctx });
  try {
    await t.fire("notes.home.toNote", { type: "click" });
    await t.fire("notes.signinForm:name", { type: "input", value: "Ada" });
    await t.fire("notes.signinSubmit", { type: "click" });
    expect(sent.filter((s) => s.startsWith("POST"))).toHaveLength(1);
    expect(t.route()).toMatchObject({ id: "notes.note", params: { noteId: "n1" } });
    expect(t.find("notes.note.title").text).toBe("Note n1");
  } finally {
    t.dispose();
  }
});

it("lets a signed-in reader open the note without a detour", async () => {
  const { ctx } = await shell();
  const t = await renderRoute("notes.signin", { routes, shell: { id: "dev.keel.shellmount" }, ctx });
  try {
    await t.fire("notes.signinForm:name", { type: "input", value: "Ada" });
    await t.fire("notes.signinSubmit", { type: "click" });
    expect(t.route()).toMatchObject({ id: "notes.home" });
    await t.fire("notes.home.toNote", { type: "click" });
    expect(t.route()).toMatchObject({ id: "notes.note", params: { noteId: "n1" } });
    expect(t.find("notes.note.title").text).toBe("Note n1");
  } finally {
    t.dispose();
  }
});
