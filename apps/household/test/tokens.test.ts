// @vitest-environment node
import { s } from "@keel/schema";
import { expect, it } from "vitest";
import mount from "../identity.ts";
import { MintedToken } from "../modules/members/MintedToken.schema.ts";
import { TokenList } from "../modules/members/TokenList.schema.ts";
import { PASSWORD, asJson, formPost, served, signIn } from "./serve.ts";

const DAY = 24 * 60 * 60 * 1000;

const Minted = s.object({ ok: s.boolean(), value: MintedToken });
const Listed = s.object({ results: s.object({ "members.tokens": s.object({ ok: s.boolean(), value: TokenList }) }) });

/** A member signed in by session cookie, as a browser on the profile page is. */
async function member(seed: number) {
  const app = await served(seed, false);
  await signIn(app.raw);
  const res = await app.raw(formPost(mount.href("/sign-in/email"), { email: "ada@example.com", password: PASSWORD }));
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0] ?? "")
    .join("; ");
  const as = (method: string, path: string, body?: unknown, extra: Record<string, string> = { cookie }) =>
    app.raw(asJson(method, path, body, extra));
  const mint = async (days = 30) => {
    const r = Minted.parse(await (await as("POST", "/api/tokens", { days })).json());
    return r.ok ? r.value.value : null;
  };
  const bearer = (token: string) => (path: string) => as("GET", path, undefined, { authorization: `Bearer ${token}` });
  return { ...app, as, mint, bearer };
}

it("mints a token that calls the API as the member, then is refused once revoked", async () => {
  const m = await member(51);
  const minted = await m.mint();
  expect(minted).not.toBeNull();
  if (minted === null) return;
  expect(minted.token.startsWith(`keelsim_${minted.id}_`)).toBe(true);
  expect((await m.bearer(minted.token)("/api/items")).status).toBe(200);
  const listed = Listed.parse(await (await m.as("GET", "/api/tokens")).json());
  expect(listed.ok && listed.value.results["members.tokens"].value.tokens.map((t) => t.id)).toEqual([minted.id]);
  const revoked = await m.as("DELETE", `/api/tokens/${minted.id}`);
  expect(revoked.status).toBe(200);
  expect(await revoked.json()).toEqual({ ok: true, value: { tokens: [] } });
  expect((await m.bearer(minted.token)("/api/items")).status).toBe(403);
});

it("stops working on the day it expires", async () => {
  const m = await member(52);
  const minted = await m.mint(7);
  if (minted === null) return expect(minted).not.toBeNull();
  m.ctx.clock.advance(7 * DAY - 1);
  expect((await m.bearer(minted.token)("/api/items")).status).toBe(200);
  m.ctx.clock.advance(1);
  expect((await m.bearer(minted.token)("/api/items")).status).toBe(403);
  const listed = Listed.parse(await (await m.as("GET", "/api/tokens")).json());
  expect(listed.ok && listed.value.results["members.tokens"].value.tokens).toEqual([]);
});

it("refuses a changed token, a token minting another, an anonymous mint and another member's revoke", async () => {
  const m = await member(53);
  const minted = await m.mint();
  if (minted === null) return expect(minted).not.toBeNull();
  const last = minted.token.at(-1) === "0" ? "1" : "0";
  expect((await m.bearer(`${minted.token.slice(0, -1)}${last}`)("/api/items")).status).toBe(403);
  const chained = await m.as("POST", "/api/tokens", { days: 30 }, { authorization: `Bearer ${minted.token}` });
  expect(chained.status).toBe(403);
  expect((await m.as("POST", "/api/tokens", { days: 30 }, {})).status).toBe(403);
  expect((await m.as("POST", "/api/tokens", { days: 91 })).status).toBe(422);
  await signIn(m.raw, "sam@example.com", "Sam");
  const sam = await m.raw(formPost(mount.href("/sign-in/email"), { email: "sam@example.com", password: PASSWORD }));
  const samCookie = sam.headers
    .getSetCookie()
    .map((c) => c.split(";")[0] ?? "")
    .join("; ");
  await m.as("DELETE", `/api/tokens/${minted.id}`, undefined, { cookie: samCookie });
  expect((await m.bearer(minted.token)("/api/items")).status).toBe(200);
});
