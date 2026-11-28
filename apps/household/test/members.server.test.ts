// @vitest-environment node
import { type SimCtx, createCtx } from "@keel/ctx";
import { type Secret, s } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import fc from "fast-check";
import { expect, it } from "vitest";
import { BearerToken } from "../modules/members/BearerToken.schema.ts";
import { authOf } from "../modules/members/authOf.server.ts";
import { authSettings } from "../modules/members/authSettings.server.ts";
import { bearerUser } from "../modules/members/bearerUser.server.ts";
import { dayOf } from "../modules/members/dayOf.ts";
import { deleteToken } from "../modules/members/deleteToken.server.ts";
import { denied } from "../modules/members/denied.ts";
import { getTokens } from "../modules/members/getTokens.server.ts";
import { loadFrame } from "../modules/members/loadFrame.server.ts";
import { loadProfile } from "../modules/members/loadProfile.server.ts";
import { loadSignin } from "../modules/members/loadSignin.server.ts";
import { loadSignup } from "../modules/members/loadSignup.server.ts";
import { member } from "../modules/members/member.guard.ts";
import { membersDb } from "../modules/members/membersDb.server.ts";
import { nextOf } from "../modules/members/nextOf.ts";
import { postToken } from "../modules/members/postToken.server.ts";
import { profileText } from "../modules/members/profileText.ts";
import { saveProfile } from "../modules/members/saveProfile.server.ts";
import { shellText } from "../modules/members/shellText.ts";
import { signText } from "../modules/members/signText.ts";
import { signedIn } from "../modules/members/signedIn.guard.ts";
import { tokensOf } from "../modules/members/tokensOf.server.ts";
import { must } from "./must.ts";
import { SEED } from "./schemas.ts";

const DAY = 24 * 60 * 60 * 1000;
/** 2026-06-15T12:00:00Z in epoch milliseconds. */
const NOON = 1781524800000;
const ADA = "user-ada";
const GRACE = "user-grace";

const at = (user: string, params: unknown = {}) => ({
  params,
  search: {},
  url: "http://localhost/x",
  caller: "caller-1",
  user,
});

/** A sim ctx with the members `ADA` and `GRACE` in the database, the clock at a fixed day. */
async function seeded(seed: number): Promise<SimCtx> {
  const ctx = createCtx({ mode: "sim", seed });
  ctx.clock.advance(NOON);
  for (const [id, email, name] of [
    [ADA, "ada@example.com", "Ada Lovelace"],
    [GRACE, "grace@example.com", "Grace Hopper"],
  ] as const) {
    const added = await membersDb(ctx).run(
      sql(NoRows)`insert into members (user_id, email, name) values (${id}, ${email}, ${name})`,
    );
    expect(added.ok).toBe(true);
  }
  return ctx;
}

const Minted = s.object({ token: s.string(), id: s.string(), expiresOn: s.string() });

async function mint(ctx: SimCtx, user: string, days = 30) {
  const r = await postToken.run({ days }, { params: {}, url: "http://localhost/api/tokens", caller: "c", user }, ctx);
  const v = r.ok ? Minted.parse(r.value) : null;
  if (v === null || !v.ok) throw new Error(`no token minted: ${JSON.stringify(r)}`);
  return v.value;
}

it("reads the sign-in library's settings from the environment: a fixture, a secret of 32 characters, or an error naming the variable", () => {
  expect(authSettings({ AUTH_FIXTURE: "test" }, [])).toMatchObject({
    ok: true,
    value: { database: ":memory:", quiet: true },
  });
  const dev = authSettings({ AUTH_FIXTURE: "dev", KEEL_ORIGIN: "https://home.example" }, []);
  expect(dev).toMatchObject({ ok: true, value: { origin: "https://home.example", quiet: false } });
  expect(dev.ok && dev.value.database).toBe(".keel-dev/auth.sqlite");
  const secret = "s".repeat(32);
  const real = authSettings({ BETTER_AUTH_SECRET: secret }, []);
  expect(real).toMatchObject({ ok: true, value: { secret, database: "auth.sqlite", quiet: false } });
  expect(authSettings({ BETTER_AUTH_SECRET: secret, AUTH_DATABASE_PATH: "/data/a.sqlite" }, [])).toMatchObject({
    value: { database: "/data/a.sqlite" },
  });
  expect(authSettings({ BETTER_AUTH_SECRET: secret }, ["--localstorage-file=/var/keel/web.json"])).toMatchObject({
    value: { database: "/var/keel/auth.sqlite" },
  });
  for (const env of [{}, { BETTER_AUTH_SECRET: "s".repeat(31) }, { AUTH_FIXTURE: "prod" }]) {
    const r = authSettings(env, []);
    expect(r).toMatchObject({ ok: false, error: { code: "members.secret" } });
    expect(JSON.stringify(r)).not.toContain("sssss");
  }
});

it("opens the library once per storage, and a different storage gets a library of its own", async () => {
  const a = createCtx({ mode: "sim", seed: 80 });
  const b = createCtx({ mode: "sim", seed: 81 });
  const first = await authOf(a);
  expect(first.ok).toBe(true);
  expect(authOf(a)).toBe(authOf(a));
  expect(authOf(b)).not.toBe(authOf(a));
  expect(first.ok && typeof first.value.api.getSession).toBe("function");
});

it("names the members who may call the API and the pages that need one, and turns away a request no member made", async () => {
  const ctx = createCtx({ mode: "sim", seed: 82 });
  expect(denied).toEqual({ code: "keel.denied", message: "sign in first", data: {} });
  expect(await member.run({ url: "http://localhost/api/tokens", user: "" }, ctx)).toMatchObject({
    ok: false,
    error: denied,
  });
  expect(await member.run({ url: "http://localhost/api/tokens", user: ADA }, ctx)).toMatchObject({ ok: true });
  expect(signedIn.redirect).toBe("members.signin");
  expect(await signedIn.run({ url: "http://localhost/profile", user: "" }, ctx)).toMatchObject({
    ok: false,
    error: denied,
  });
  expect(await signedIn.run({ url: "http://localhost/profile", user: ADA }, ctx)).toMatchObject({ ok: true });
  expect(member.redirect).toBeUndefined();
});

it("carries a next page from one sign-in page to the other only when there is one", () => {
  expect(nextOf({})).toEqual({});
  expect(nextOf({ error: "invalid" })).toEqual({});
  expect(nextOf({ next: "/list" })).toEqual({ next: "/list" });
  expect(nextOf({ error: "credentials", next: "/de-DE/receipts" })).toEqual({ next: "/de-DE/receipts" });
});

it("gives the UTC calendar day of an epoch millisecond, and null outside years 1 to 9999", () => {
  expect(dayOf(0)).toBe("1970-01-01");
  expect(dayOf(DAY - 1)).toBe("1970-01-01");
  expect(dayOf(DAY)).toBe("1970-01-02");
  expect(dayOf(-1)).toBe("1969-12-31");
  expect(dayOf(951868799999)).toBe("2000-02-29");
  expect(dayOf(4107542399999)).toBe("2100-02-28");
  expect(dayOf(4107542400000)).toBe("2100-03-01");
  expect(dayOf(-62135596800000)).toBe("0001-01-01");
  expect(dayOf(-62135596800001)).toBeNull();
  expect(dayOf(253402300799999)).toBe("9999-12-31");
  expect(dayOf(253402300800000)).toBeNull();
  expect(dayOf(Number.NaN)).toBeNull();
  expect(dayOf(Number.POSITIVE_INFINITY)).toBeNull();
});

it("holds one day for every millisecond of it, and the next day after it, over any day in range", () => {
  const first = Math.ceil(-62135596800000 / DAY);
  const last = Math.floor(253402300799999 / DAY) - 1;
  fc.assert(
    fc.property(fc.integer({ min: first, max: last }), fc.integer({ min: 0, max: DAY - 1 }), (day, within) => {
      const start = dayOf(day * DAY);
      expect(start).not.toBeNull();
      expect(dayOf(day * DAY + within)).toBe(start);
      const next = dayOf((day + 1) * DAY);
      expect(next).not.toBeNull();
      expect((next ?? "") > (start ?? "")).toBe(true);
      expect(dayOf(day * DAY - 1)?.localeCompare(start ?? "") ?? -1).toBeLessThan(0);
    }),
    { numRuns: 300, seed: SEED },
  );
});

it("serves the sign-in, sign-up and frame loaders without a member, with the copy the pages ship", async () => {
  const ctx = createCtx({ mode: "sim", seed: 83 });
  expect(await loadSignin.run(at(""), ctx)).toEqual({ ok: true, value: { text: signText } });
  expect(await loadSignup.run(at(""), ctx)).toEqual({ ok: true, value: { text: signText } });
  expect(await loadFrame.run(at(""), ctx)).toEqual({
    ok: true,
    value: { text: shellText, name: null, signedIn: false },
  });
  expect(await loadFrame.run(at(ADA), ctx)).toEqual({
    ok: true,
    value: { text: shellText, name: null, signedIn: true },
  });
});

it("lists a member's working tokens, the one ending first first, each with the day it ends", async () => {
  const ctx = await seeded(84);
  const long = await mint(ctx, ADA, 60);
  const short = await mint(ctx, ADA, 2);
  await mint(ctx, GRACE, 10);
  const list = await tokensOf(ADA, ctx);
  expect(list).toEqual({
    ok: true,
    value: [
      { id: short.id, expiresOn: "2026-06-17" },
      { id: long.id, expiresOn: "2026-08-14" },
    ],
  });
  ctx.clock.advance(2 * DAY);
  expect(await tokensOf(ADA, ctx)).toEqual({ ok: true, value: [{ id: long.id, expiresOn: "2026-08-14" }] });
  expect(await tokensOf("nobody", ctx)).toEqual({ ok: true, value: [] });
});

it("answers the token list to a member and denies it to no one", async () => {
  const ctx = await seeded(85);
  expect(await getTokens.run(at(""), ctx)).toMatchObject({ ok: false, error: denied });
  expect(await getTokens.run(at(ADA), ctx)).toEqual({ ok: true, value: { tokens: [] } });
  const made = await mint(ctx, ADA);
  expect(await getTokens.run(at(ADA), ctx)).toMatchObject({ ok: true, value: { tokens: [{ id: made.id }] } });
  expect(await getTokens.run(at(GRACE), ctx)).toEqual({ ok: true, value: { tokens: [] } });
});

it("mints for a member only, shows the token once, never mints from a token, and keeps its expiry", async () => {
  const ctx = await seeded(86);
  const call = (user: string, bearer?: Secret<string>) =>
    postToken.run({ days: 30 }, { params: {}, url: "http://localhost/api/tokens", caller: "c", user, bearer }, ctx);
  expect(await call("")).toMatchObject({ ok: false, error: denied });
  const presented = BearerToken.parse("keelsim_anything");
  if (!presented.ok) throw new Error("the token text did not parse");
  expect(await call(ADA, presented.value)).toMatchObject({ ok: false, error: denied });
  const made = await mint(ctx, ADA, 7);
  expect(made.token.startsWith(`keelsim_${made.id}_`)).toBe(true);
  expect(made.expiresOn).toBe("2026-06-22");
  const listed = await membersDb(ctx).query(
    sql(
      s.object({ digest: s.string(), expiresAt: s.int() }),
    )`select digest, expires_at as "expiresAt" from api_tokens where id = ${made.id}`,
  );
  expect(listed.ok && listed.value).toHaveLength(1);
  expect(listed.ok && listed.value[0]?.expiresAt).toBe(ctx.clock.now() + 7 * DAY);
  expect(JSON.stringify(listed)).not.toContain(made.token);
});

it("knows the member behind an Authorization header, and no one behind anything else", async () => {
  const ctx = await seeded(87);
  const made = await mint(ctx, ADA, 3);
  expect(await bearerUser(`Bearer ${made.token}`, ctx)).toBe(ADA);
  expect(await bearerUser(`bearer ${made.token}`, ctx)).toBe(ADA);
  expect(await bearerUser(`Basic ${made.token}`, ctx)).toBe("");
  expect(await bearerUser(made.token, ctx)).toBe("");
  expect(await bearerUser("Bearer ", ctx)).toBe("");
  expect(await bearerUser("Bearer not a token", ctx)).toBe("");
  expect(await bearerUser(`Bearer ${made.token.slice(0, -1)}${made.token.endsWith("a") ? "b" : "a"}`, ctx)).toBe("");
  expect(await bearerUser(`Bearer keelsim_nope_${"0".repeat(40)}`, ctx)).toBe("");
  ctx.clock.advance(3 * DAY - 1);
  expect(await bearerUser(`Bearer ${made.token}`, ctx)).toBe(ADA);
  ctx.clock.advance(1);
  expect(await bearerUser(`Bearer ${made.token}`, ctx)).toBe("");
});

it("revokes a member's own token for good, and no one else's", async () => {
  const ctx = await seeded(88);
  const mine = await mint(ctx, ADA);
  const hers = await mint(ctx, GRACE);
  const args = (user: string, id: string) => ({
    params: { id },
    url: "http://localhost/api/tokens/x",
    caller: "c",
    user,
  });
  expect(await deleteToken.run({}, args("", mine.id), ctx)).toMatchObject({ ok: false, error: denied });
  expect(await deleteToken.run({}, args(GRACE, mine.id), ctx)).toEqual({
    ok: true,
    value: { tokens: [{ id: hers.id, expiresOn: "2026-07-15" }] },
  });
  expect(await bearerUser(`Bearer ${mine.token}`, ctx)).toBe(ADA);
  expect(await deleteToken.run({}, args(ADA, mine.id), ctx)).toEqual({ ok: true, value: { tokens: [] } });
  expect(await bearerUser(`Bearer ${mine.token}`, ctx)).toBe("");
  expect(await bearerUser(`Bearer ${hers.token}`, ctx)).toBe(GRACE);
  expect(await deleteToken.run({}, args(ADA, mine.id), ctx)).toEqual({ ok: true, value: { tokens: [] } });
});

it("loads the profile from the member's row and tokens, and denies a visitor and a member with no row", async () => {
  const ctx = await seeded(89);
  expect(await loadProfile.run(at(""), ctx)).toMatchObject({ ok: false, error: denied });
  expect(await loadProfile.run(at("stranger"), ctx)).toMatchObject({ ok: false, error: denied });
  expect(await loadProfile.run(at(ADA), ctx)).toEqual({
    ok: true,
    value: { text: profileText, email: "ada@example.com", name: "Ada Lovelace", tokens: [] },
  });
  must(await membersDb(ctx).run(sql(NoRows)`update members set phone = '0161 496 0000' where user_id = ${ADA}`));
  const made = await mint(ctx, ADA);
  expect(await loadProfile.run(at(ADA), ctx)).toMatchObject({
    ok: true,
    value: { phone: "0161 496 0000", tokens: [{ id: made.id }] },
  });
});

it("saves the member's name and phone and sends the page back marked saved; a phone left out clears it", async () => {
  const ctx = await seeded(90);
  const post = (user: string, input: { name: string; phone?: string }) =>
    saveProfile.run(input, { params: {}, url: "http://localhost/profile", caller: "c", user }, ctx);
  expect(await post("", { name: "Eve" })).toMatchObject({ ok: false, error: denied });
  expect(await post(ADA, { name: "Ada", phone: "0161 496 0000" })).toEqual({ ok: true, value: "/profile?saved=true" });
  const Row = s.object({ name: s.string(), phone: s.string().nullable() });
  const read = (id: string) => membersDb(ctx).query(sql(Row)`select name, phone from members where user_id = ${id}`);
  expect(await read(ADA)).toEqual({ ok: true, value: [{ name: "Ada", phone: "0161 496 0000" }] });
  expect(await read(GRACE)).toEqual({ ok: true, value: [{ name: "Grace Hopper", phone: null }] });
  expect(await post(ADA, { name: "Ada L" })).toMatchObject({ ok: true });
  expect(await read(ADA)).toEqual({ ok: true, value: [{ name: "Ada L", phone: null }] });
});
