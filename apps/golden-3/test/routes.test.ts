import { type Ctx, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { isolate, tx } from "@keel/store";
import { render, renderRoute } from "@keel/testing";
import { expect, test } from "vitest";
import { Board } from "../modules/shifts/Board.schema.ts";
import { Signup } from "../modules/shifts/Signup.schema.ts";
import { board } from "../modules/shifts/board.ts";
import { shifts } from "../modules/shifts/shifts.contract.ts";
import { webRoutes } from "./webRoutes.ts";

const mine = "00000000-0000-4000-8000-000000000001";
const theirs = "00000000-0000-4000-8000-000000000002";

/** A sim ctx whose storage already holds the board: `mine` signed up by caller `me`, `theirs` by caller `other`. */
async function seeded(organizers?: readonly string[], fillThree = false): Promise<Ctx> {
  const ctx = createCtx({ mode: "sim", seed: 1 });
  const sc = scope(() => undefined);
  isolate(sc);
  const stores = sc.run(() => board());
  const rows = [
    Signup.parse({
      id: mine,
      shiftId: "s1",
      name: "Ada Lovelace",
      email: "ada@example.org",
      phone: "555 0100",
      needs: "Step-free access",
      owner: "me",
      attended: false,
    }),
    Signup.parse({
      id: theirs,
      shiftId: "s2",
      name: "Grace Hopper",
      email: "grace@example.org",
      owner: "other",
      attended: false,
    }),
  ];
  if (fillThree) {
    for (const n of [3, 4]) {
      rows.push(
        Signup.parse({
          id: `00000000-0000-4000-8000-00000000000${n}`,
          shiftId: "s3",
          name: `Helper ${n}`,
          email: `h${n}@example.org`,
          owner: `h${n}`,
          attended: false,
        }),
      );
    }
  }
  for (const row of rows) if (row.ok) expect(tx(stores.signUp, row.value).ok).toBe(true);
  await ctx.storage.set("keel.store.shifts.board", JSON.stringify(stores.board.snapshot({ meta: true })));
  if (organizers !== undefined) await ctx.storage.set("shifts.organizers", JSON.stringify(organizers));
  return ctx;
}

const saved = async (ctx: Ctx) => {
  const raw = await ctx.storage.get("keel.store.shifts.board");
  const parsed = s.object({ state: Board }).parse(raw === null ? null : JSON.parse(raw));
  return parsed.ok ? parsed.value.state : { shifts: [], signups: [] };
};

test("shifts.index lists each shift with its open places", async () => {
  const ctx = await seeded();
  const r = await renderRoute("shifts.index", { routes: webRoutes, ctx, caller: "me" });
  expect(r.find("shifts.title").text).toBe("Volunteer shifts");
  expect(r.find("shifts.link.s1").text).toBe("Sorting donations");
  expect(r.find("shifts.when.s2").text).toBe("Saturday 13:00 to 16:00");
  expect(r.find("shifts.open.s1").text).toBe("3 of 4 places open");
  expect(r.find("shifts.open.s3").text).toBe("2 of 2 places open");
});

test("shifts.show shows the shift and the sign-up form in tab order", async () => {
  const ctx = await seeded();
  const r = await renderRoute("shifts.show", { routes: webRoutes, params: { shiftId: "s1" }, ctx, caller: "me" });
  expect(r.find("shifts.show.title").text).toBe("Sorting donations");
  expect(r.find("shifts.show.when").text).toBe("Saturday 9:00 to 12:00");
  expect(r.find("shifts.show.open").text).toBe("3 of 4 places open");
  const form = [
    "shifts.join:name",
    "shifts.join:email",
    "shifts.join:phone",
    "shifts.join:needs",
    "shifts.join.submit",
  ];
  expect(r.focusOrder().filter((id) => id.startsWith("shifts.join"))).toEqual(form);
  expect(r.focusOrder()).toEqual(["shifts.home", "shifts.mineLink", ...form]);
});

test("a full shift says so and shows no form", async () => {
  const ctx = await seeded(undefined, true);
  const r = await renderRoute("shifts.show", { routes: webRoutes, params: { shiftId: "s3" }, ctx, caller: "me" });
  expect(r.find("shifts.show.open").text).toBe("0 of 2 places open");
  expect(r.find("shifts.show.full").text).toBe("This shift is full");
  expect(() => r.find("shifts.join:name")).toThrow();
});

test("shifts.mine lists only the caller's sign-ups", async () => {
  const ctx = await seeded();
  const r = await renderRoute("shifts.mine", { routes: webRoutes, ctx, caller: "me" });
  expect(r.find("shifts.mine.title").text).toBe("My sign-ups");
  expect(r.find(`shifts.mine.shift.${mine}`).text).toBe("Sorting donations, Saturday 9:00 to 12:00");
  expect(r.find(`shifts.mine.cancel.${mine}`).text).toBe("Cancel Sorting donations");
  const none = await renderRoute("shifts.mine", { routes: webRoutes, ctx, caller: "nobody" });
  expect(none.find("shifts.mine.empty").text).toBe("You have no sign-ups yet");
});

test("shifts.signup shows the caller's own sign-up", async () => {
  const ctx = await seeded();
  const r = await renderRoute("shifts.signup", { routes: webRoutes, params: { signupId: mine }, ctx, caller: "me" });
  expect(r.find("shifts.signup.title").text).toBe("Cancel your sign-up");
  expect(r.find("shifts.signup.shift").text).toBe("Sorting donations, Saturday 9:00 to 12:00");
  expect(r.find("shifts.cancel").text).toBe("Cancel sign-up");
});

test("shifts.roster shows contact details to an organizer", async () => {
  const ctx = await seeded(["boss"]);
  const r = await renderRoute("shifts.roster", { routes: webRoutes, ctx, caller: "boss" });
  expect(r.find("shifts.roster.title").text).toBe("Roster");
  expect(r.find("shifts.roster.shift.s1").text).toBe("Sorting donations");
  expect(r.find(`shifts.roster.name.${mine}`).text).toBe("Ada Lovelace");
  expect(r.find(`shifts.roster.email.${mine}`).text).toBe("ada@example.org");
  expect(r.find(`shifts.roster.phone.${mine}`).text).toBe("555 0100");
  expect(r.find(`shifts.roster.needs.${mine}`).text).toBe("Step-free access");
  expect(r.find(`shifts.roster.attended.${mine}`).text).toBe("Not yet");
  expect(r.find(`shifts.roster.phone.${theirs}`).text).toBe("No phone");
  expect(r.find(`shifts.roster.needs.${theirs}`).text).toBe("None given");
  expect(r.find(`shifts.roster.mark.${mine}`).text).toBe("Attendance for Ada Lovelace");
});

test("shifts.attend marks attendance and returns to the roster", async () => {
  const ctx = await seeded(["boss"]);
  const r = await renderRoute("shifts.attend", { routes: webRoutes, params: { signupId: mine }, ctx, caller: "boss" });
  expect(r.find("shifts.attend.title").text).toBe("Attendance");
  expect(r.find("shifts.attend.who").text).toBe("Ada Lovelace, Sorting donations");
  await r.fire("shifts.attend:attended", { type: "click" });
  await r.fire("shifts.attend.save", { type: "click" });
  expect(r.route().id).toBe("shifts.roster");
  expect(r.find(`shifts.roster.attended.${mine}`).text).toBe("Attended");
  expect((await saved(ctx)).signups.map((x) => x.attended)).toEqual([true, false]);
});

test("signing up through the form lands on shifts.mine", async () => {
  const ctx = await seeded();
  const r = await renderRoute("shifts.show", { routes: webRoutes, params: { shiftId: "s2" }, ctx, caller: "newcomer" });
  await r.fire("shifts.join:name", { type: "input", value: "Katherine Johnson" });
  await r.fire("shifts.join:email", { type: "input", value: "kj@example.org" });
  await r.fire("shifts.join:phone", { type: "input", value: "555 0199" });
  await r.fire("shifts.join:needs", { type: "input", value: "Large print" });
  await r.fire("shifts.join.submit", { type: "click" });
  expect(r.route().id).toBe("shifts.mine");
  const rows = (await saved(ctx)).signups.filter((x) => x.owner === "newcomer");
  expect(rows.map((x) => x.name)).toEqual(["Katherine Johnson"]);
  expect(r.find("shifts.mine.title").text).toBe("My sign-ups");
});

test("an invalid submit focuses the name field and signs nobody up", async () => {
  const ctx = await seeded();
  const r = await renderRoute("shifts.show", { routes: webRoutes, params: { shiftId: "s2" }, ctx, caller: "newcomer" });
  await r.fire("shifts.join.submit", { type: "click" });
  expect(r.find("shifts.join:name").state.focused).toBe(true);
  expect(r.route().id).toBe("shifts.show");
  expect((await saved(ctx)).signups).toHaveLength(2);
});

test("cancelling a sign-up removes it and returns to shifts.mine", async () => {
  const ctx = await seeded();
  const r = await renderRoute("shifts.mine", { routes: webRoutes, ctx, caller: "me" });
  await r.fire(`shifts.mine.cancel.${mine}`, { type: "click" });
  expect(r.route().id).toBe("shifts.signup");
  await r.fire("shifts.cancel", { type: "click" });
  expect(r.route().id).toBe("shifts.mine");
  expect(r.find("shifts.mine.empty").text).toBe("You have no sign-ups yet");
  expect((await saved(ctx)).signups.map((x) => x.id)).toEqual([theirs]);
});

test("moving from the list to a shift focuses its heading", async () => {
  const ctx = await seeded();
  const r = await renderRoute("shifts.index", { routes: webRoutes, ctx, caller: "me" });
  await r.navigate(shifts.href("shifts.show", { shiftId: "s2" }));
  expect(r.route().id).toBe("shifts.show");
  expect(r.find("shifts.show.title").state.focused).toBe(true);
});

test("a caller who is not an organizer lands on the shift list from the roster", async () => {
  const ctx = await seeded(["boss"]);
  const r = await renderRoute("shifts.roster", { routes: webRoutes, ctx, caller: "me" });
  expect(r.route().id).toBe("shifts.index");
  expect(r.find("shifts.title").text).toBe("Volunteer shifts");
});

test("another caller's sign-up and an unknown shift are not found", async () => {
  const ctx = await seeded();
  const r = await renderRoute("shifts.signup", { routes: webRoutes, params: { signupId: theirs }, ctx, caller: "me" });
  expect(r.find("shifts.error").text).toBe("Not found");
  const unknown = await renderRoute("shifts.show", { routes: webRoutes, params: { shiftId: "zz" }, ctx, caller: "me" });
  expect(unknown.find("shifts.error").text).toBe("Not found");
});
