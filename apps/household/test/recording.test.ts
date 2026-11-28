// std.sessions: `record` keeps every value but `redact` entries and `.pii()` values; std.monitor: names and counts
// only. A member uses the profile and the list under the frame's recorder: the note shows what the recorder kept, the
// recording and its upload hold no personal value, a visitor's recording of the start page replays, the member is
// no reader, and the tally counts the setup commit.
import { piiPaths } from "@keel/schema";
import { record, session } from "@keel/std-sessions";
import { replay } from "@keel/std-sessions/replay";
import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import { Profile } from "../modules/members/Profile.schema.ts";
import { EMAIL, NAME, PASSWORD, asJson, formPost, served, webRoutes } from "./serve.ts";

/** Distinctive values for the profile's two marked fields: finding one in a sink is a leak. */
const CANARY = { name: "Quillon Vantablack", phone: "+44 7700 900417" };

/** The canaries, the member's sign-up details and their id that `text` holds: `[]` when none leaked. */
function leaked(text: string, user: string): string[] {
  const values = { ...CANARY, email: EMAIL, signupName: NAME, password: PASSWORD, user };
  const forms = (v: string) => [v, encodeURIComponent(v), JSON.stringify(v).slice(1, -1)];
  return Object.entries(values)
    .filter(([, v]) => forms(v).some((f) => text.includes(f)))
    .map(([k]) => k);
}

/** A member on the profile page with the note open, the two marked fields typed. */
async function typed(seed: number) {
  const s = await served(seed);
  const page = await renderRoute("members.profile", {
    routes: webRoutes,
    params: {},
    ctx: s.ctx,
    app: s.app,
    user: s.user,
  });
  await page.fire("app.recording.note.button", { type: "click" });
  await page.fire("members.profileForm:name", { type: "input", value: CANARY.name });
  await page.fire("members.profileForm:phone", { type: "input", value: CANARY.phone });
  return { ...s, page };
}

it("marks both profile fields, so the recorder masks what is typed into them", () => {
  expect(piiPaths(Profile).map((p) => p.path)).toEqual(["name", "phone"]);
});

it("shows in the note what the recorder kept: the typed name and phone as x repeated", async () => {
  const { page, user } = await typed(71);
  const note = page.find("app.recording.events").text;
  expect(note).toContain(`input members.profileForm:name "${"x".repeat(CANARY.name.length)}"`);
  expect(note).toContain(`input members.profileForm:phone "${"x".repeat(CANARY.phone.length)}"`);
  expect(note).toContain("click app.recording.note.button");
  expect(leaked(note, user)).toEqual([]);
  expect(page.find("app.recording.count").text).toMatch(/^[1-9]\d* events kept$/);
  expect(page.find("app.recording.count").role).toBe("status");
  page.dispose();
});

it("keeps no personal value in the recording, in its upload or in the archive the server files it in", async () => {
  const { page, ctx, user, raw } = await typed(72);
  page.dispose();
  const out = record(ctx).stop();
  expect(out.route.id).toBe("members.profile");
  expect(out.events.filter((e) => e.kind === "fire").length).toBeGreaterThanOrEqual(3);
  expect(leaked(JSON.stringify(out), user)).toEqual([]);

  const put = await session(ctx).put(new URL("/sessions", location.origin), out);
  expect(put.ok).toBe(true);
  expect(leaked(JSON.stringify(session(ctx).taken()), user)).toEqual([]);

  expect((await raw(asJson("POST", "/sessions", out))).status).toBe(200);
  const archive = (await ctx.storage.get("keel.store.sessions.archive")) ?? "";
  expect(archive).toContain(out.fingerprint);
  expect(leaked(archive, user)).toEqual([]);
});

it("replays a visitor's recording of the start page to the same state and fingerprint", async () => {
  const s = await served(74, false);
  const page = await renderRoute("app.start", { routes: webRoutes, params: {}, ctx: s.ctx, app: s.app });
  await page.fire("app.recording.note.button", { type: "click" });
  page.dispose();
  const out = record(s.ctx).stop();
  const again = await replay(out, { routes: webRoutes });
  expect({ reproduced: again.reproduced, unapplied: again.unapplied }).toEqual({ reproduced: true, unapplied: null });
});

it("admits no member to the recordings or the tally, and counts the setup commit by name only", async () => {
  const { ctx, fetch, raw } = await served(75);
  expect((await fetch(formPost("/setup", { name: "Elm Street" }))).status).toBe(303);
  ctx.clock.advance(60_000);
  for (const path of ["/sessions/list", "/sessions/tally"]) {
    expect({ path, status: (await fetch(asJson("GET", path))).status }).toEqual({ path, status: 403 });
    expect({ path, status: (await raw(asJson("GET", path))).status }).toEqual({ path, status: 403 });
  }
  const tally = (await ctx.storage.get("sessions.tally")) ?? "";
  expect(JSON.parse(tally)).toMatchObject({ v: 1, tx: { "setup.household.name": 1 } });
  expect(tally).not.toContain("Elm Street");
});
