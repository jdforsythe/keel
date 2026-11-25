import { expect, it } from "vitest";
import { BearerToken } from "../modules/members/BearerToken.schema.ts";
import { Credentials } from "../modules/members/Credentials.schema.ts";
import { ErrorReply } from "../modules/members/ErrorReply.schema.ts";
import { MemberRow } from "../modules/members/MemberRow.schema.ts";
import { MintedToken } from "../modules/members/MintedToken.schema.ts";
import { ProfileData } from "../modules/members/ProfileData.schema.ts";
import { ProfileSearch } from "../modules/members/ProfileSearch.schema.ts";
import { ProfileText } from "../modules/members/ProfileText.schema.ts";
import { Registration } from "../modules/members/Registration.schema.ts";
import { ShellData } from "../modules/members/ShellData.schema.ts";
import { ShellText } from "../modules/members/ShellText.schema.ts";
import { SignData } from "../modules/members/SignData.schema.ts";
import { SignError } from "../modules/members/SignError.schema.ts";
import { SignSearch } from "../modules/members/SignSearch.schema.ts";
import { SignText } from "../modules/members/SignText.schema.ts";
import { SignedInUser } from "../modules/members/SignedInUser.schema.ts";
import { TokenExpiry } from "../modules/members/TokenExpiry.schema.ts";
import { TokenInfo } from "../modules/members/TokenInfo.schema.ts";
import { TokenList } from "../modules/members/TokenList.schema.ts";
import { TokenRef } from "../modules/members/TokenRef.schema.ts";
import { TokenRequest } from "../modules/members/TokenRequest.schema.ts";
import { TokenRow } from "../modules/members/TokenRow.schema.ts";
import { profileText } from "../modules/members/profileText.ts";
import { shellText } from "../modules/members/shellText.ts";
import { signText } from "../modules/members/signText.ts";
import { acceptsGenerated, issuePaths, rejectsAt, survivesJson } from "./schemas.ts";

it("the copy the pages ship satisfies the schemas that type it, and every key is non-empty", () => {
  expect(ProfileText.parse(profileText).ok).toBe(true);
  expect(ShellText.parse(shellText).ok).toBe(true);
  expect(SignText.parse(signText).ok).toBe(true);
  expect(ShellData.parse({ text: shellText, name: null, signedIn: false }).ok).toBe(true);
  expect(SignData.parse({ text: signText }).ok).toBe(true);
  rejectsAt(ShellText, { ...shellText, nav: "" }, "nav");
  rejectsAt(ProfileText, { ...profileText, mint: "" }, "mint");
  const { errorInvalid: _gone, ...partial } = signText;
  rejectsAt(SignText, partial, "errorInvalid");
});

it("every generated value of a plain shape parses and survives the wire", () => {
  for (const schema of [
    ErrorReply,
    MemberRow,
    MintedToken,
    ProfileData,
    ProfileSearch,
    ProfileText,
    ShellData,
    ShellText,
    SignData,
    SignError,
    SignSearch,
    SignText,
    SignedInUser,
    TokenExpiry,
    TokenInfo,
    TokenList,
    TokenRef,
    TokenRequest,
  ]) {
    acceptsGenerated(schema, 50);
    survivesJson(schema, 50);
  }
});

it("a token request is one to ninety whole days", () => {
  expect(TokenRequest.parse({ days: 1 }).ok).toBe(true);
  expect(TokenRequest.parse({ days: 90 }).ok).toBe(true);
  for (const days of [0, 91, -3, 1.5, "30", null]) rejectsAt(TokenRequest, { days }, "days");
  rejectsAt(TokenRequest, {}, "days");
});

it("a token reference and a token row carry an id of 1 to 64 characters", () => {
  expect(TokenRef.parse({ id: "a" }).ok).toBe(true);
  rejectsAt(TokenRef, { id: "" }, "id");
  rejectsAt(TokenRef, { id: "x".repeat(65) }, "id");
  rejectsAt(TokenExpiry, { id: "t", expiresAt: 1.5 }, "expiresAt");
  expect(TokenExpiry.parse({ id: "t", expiresAt: -5 }).ok).toBe(true);
  rejectsAt(TokenInfo, { id: "t", expiresOn: "not a day" }, "expiresOn");
  rejectsAt(TokenInfo, { id: "t", expiresOn: "2026-02-30" }, "expiresOn");
  expect(TokenInfo.parse({ id: "t", expiresOn: "2026-02-28" }).ok).toBe(true);
  rejectsAt(
    TokenList,
    {
      tokens: [
        { id: "t", expiresOn: "2026-02-28" },
        { id: "", expiresOn: "2026-02-28" },
      ],
    },
    "tokens.1.id",
  );
  rejectsAt(MintedToken, { token: "t", id: "i", expiresOn: "2026-13-01" }, "expiresOn");
});

it("a sign-in search names a known refusal and a next page of at most 200 characters", () => {
  for (const error of ["credentials", "invalid"]) {
    expect(SignError.parse(error).ok).toBe(true);
    expect(SignSearch.parse({ error }).ok).toBe(true);
  }
  expect(SignError.parse("locked").ok).toBe(false);
  rejectsAt(SignSearch, { error: "locked" }, "error");
  rejectsAt(SignSearch, { next: "/".repeat(201) }, "next");
  expect(SignSearch.parse({ next: "/".repeat(200) }).ok).toBe(true);
  expect(SignSearch.parse({}).ok).toBe(true);
  rejectsAt(ProfileSearch, { saved: "yes" }, "saved");
  expect(ProfileSearch.parse({ saved: true }).ok).toBe(true);
});

it("the library's answer to a sign-in must hold an id, an email and a name, and the answer's extra fields are not read", () => {
  const user = { id: "u1", email: "ada@example.com", name: "Ada" };
  expect(SignedInUser.parse({ user, token: "ignored" }).ok).toBe(true);
  rejectsAt(SignedInUser, { user: { ...user, id: "" } }, "user.id");
  rejectsAt(SignedInUser, { user: { ...user, email: "a@" } }, "user.email");
  rejectsAt(SignedInUser, { user: { ...user, name: "" } }, "user.name");
  rejectsAt(SignedInUser, { user: { ...user, name: "n".repeat(101) } }, "user.name");
  rejectsAt(SignedInUser, null, "");
});

it("the member row reads a phone as a line or null, and a name as a line", () => {
  const row = { email: "ada@example.com", name: "Ada", phone: null };
  expect(MemberRow.parse(row).ok).toBe(true);
  expect(MemberRow.parse({ ...row, phone: "0161 496 0000" }).ok).toBe(true);
  rejectsAt(MemberRow, { ...row, phone: "line one\nline two" }, "phone");
  rejectsAt(MemberRow, { ...row, name: "a\nb" }, "name");
  rejectsAt(MemberRow, { ...row, phone: "9".repeat(31) }, "phone");
  rejectsAt(MemberRow, { name: "Ada", phone: null }, "email");
});

it("a profile page's data holds the member's details and each token", () => {
  const data = { text: profileText, email: "ada@example.com", name: "Ada", tokens: [] };
  expect(ProfileData.parse(data).ok).toBe(true);
  rejectsAt(ProfileData, { ...data, tokens: [{ id: "", expiresOn: "2026-01-01" }] }, "tokens.0.id");
  rejectsAt(ProfileData, { ...data, text: { ...profileText, heading: "" } }, "text.heading");
});

it("an error reply is a code, a message and any JSON data", () => {
  expect(ErrorReply.parse({ code: "keel.denied", message: "sign in first", data: null }).ok).toBe(true);
  expect(ErrorReply.parse({ code: "x", message: "y", data: { a: [1, { b: null }] } }).ok).toBe(true);
  rejectsAt(ErrorReply, { code: 403, message: "y", data: null }, "code");
});

it("a password is a secret from the moment it parses, at the library's lengths", () => {
  const typed = { email: "ada@example.com", password: "analytical engine" };
  const parsed = Credentials.parse(typed);
  expect(parsed.ok).toBe(true);
  expect(JSON.stringify(parsed)).not.toContain(typed.password);
  expect(String(parsed.ok && parsed.value.password)).not.toContain(typed.password);
  rejectsAt(Credentials, { ...typed, password: "short" }, "password");
  rejectsAt(Credentials, { ...typed, password: "p".repeat(129) }, "password");
  rejectsAt(Credentials, { ...typed, email: "a@" }, "email");
  rejectsAt(Credentials, { ...typed, email: `${"a".repeat(250)}@b.cc` }, "email");
  const signUp = Registration.parse({ ...typed, name: "Ada Lovelace" });
  expect(signUp.ok).toBe(true);
  expect(JSON.stringify(signUp)).not.toContain(typed.password);
  rejectsAt(Registration, { ...typed, name: "" }, "name");
  rejectsAt(Registration, { ...typed, name: "n".repeat(101) }, "name");
  rejectsAt(Registration, { ...typed, name: "Ada", password: "1234567" }, "password");
});

it("a bearer token is a secret string of 1 to 4096 characters", () => {
  const ok = BearerToken.parse("keelsim_abc_def");
  expect(ok.ok).toBe(true);
  expect(JSON.stringify(ok)).not.toContain("keelsim_abc_def");
  expect(issuePaths(BearerToken, "")).not.toEqual([]);
  expect(BearerToken.parse("t".repeat(4096)).ok).toBe(true);
  expect(BearerToken.parse("t".repeat(4097)).ok).toBe(false);
  expect(BearerToken.parse(undefined).ok).toBe(false);
});

it("a token row needs a digest in the shape std-tokens keeps", () => {
  const row = { id: "t1", digest: "not a digest", userId: "u1" };
  expect(TokenRow.parse(row).ok).toBe(false);
  rejectsAt(TokenRow, { ...row, userId: "" }, "userId");
  rejectsAt(TokenRow, { id: "", digest: "x", userId: "u" }, "id");
});
