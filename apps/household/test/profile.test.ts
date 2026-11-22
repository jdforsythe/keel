import { s } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { properties, renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import ProfilePage from "../modules/members/ProfilePage.tsx";
import { membersDb } from "../modules/members/membersDb.server.ts";
import { EMAIL, asJson, formPost, served, webRoutes } from "./serve.ts";

const Row = s.object({ name: s.string(), phone: s.string().nullable() });

/** Distinctive values typed into the profile's personal fields; none may reach a log line. */
const CANARY = { name: "Quillon Vantablack", phone: "+44 7700 900417" };

it("shows the member's details from their first sign-in, and the token the test minted", async () => {
  const { ctx, user } = await served(61);
  const page = await renderRoute("members.profile", { routes: webRoutes, params: {}, ctx, user });
  expect(page.find("members.signedIn").text).toBe(`Signed in as ${EMAIL}`);
  expect(page.find("members.tokens.list").text).toContain("Works until");
  expect(page.focusOrder()).toEqual([
    "app.nav.list",
    "app.nav.receipts",
    "app.nav.setup",
    "app.nav.profile",
    "app.nav.signOut",
    "members.profileForm:name",
    "members.profileForm:phone",
    "members.save",
    "members.mint",
    "members.revoke.0",
  ]);
  page.dispose();
});

it("saves the name and phone the member types", async () => {
  const { ctx, user } = await served(62);
  const page = await renderRoute("members.profile", { routes: webRoutes, params: {}, ctx, user });
  await page.fire("members.profileForm:name", { type: "input", value: "Ada" });
  await page.fire("members.profileForm:phone", { type: "input", value: "0161 496 0000" });
  await page.fire("members.save", { type: "click" });
  expect(page.find("members.saved").text).toBe("Saved.");
  page.dispose();
  const rows = await membersDb(ctx).query(sql(Row)`select name, phone from members where user_id = ${user}`);
  expect(rows.ok && rows.value).toEqual([{ name: "Ada", phone: "0161 496 0000" }]);
});

it("keeps typed personal data out of every log line, saved or refused", async () => {
  const { fetch, lines } = await served(63);
  expect((await fetch(formPost("/profile", CANARY))).status).toBe(303);
  expect((await fetch(formPost("/profile", { ...CANARY, phone: `${CANARY.phone}${"9".repeat(40)}` }))).status).toBe(
    422,
  );
  expect((await fetch(asJson("GET", "/api/tokens"))).status).toBe(200);
  expect(lines.length).toBeGreaterThan(0);
  for (const value of Object.values(CANARY)) expect(lines.filter((l) => l.includes(value))).toEqual([]);
});

it("renders any profile the schemas allow", { timeout: 30_000 }, async () => {
  await properties(ProfilePage, { runs: 100, seed: 6 });
});
