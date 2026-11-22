// std.sessions: "every `.pii()`-marked path ... is redacted", "`s.secret` fields always go", and a recorder treats
// "every password field" as matched. k.privacy: marked and secret fields "belong in an action `input`, never in a
// route's `params` or `search`". The canaries of `canaries.ts` are typed into the sign-up and sign-in pages under one
// recorder; the recording, the session as uploaded and the URL of each document the pages opened are each a sink.
import { createCtx } from "@keel/ctx";
import { record, session } from "@keel/std-sessions";
import { renderRoute } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { routes } from "../modules/accounts/routes.ts";
import { BASE } from "./accountsApp.ts";
import { CANARIES, CANARY_EMAIL, CANARY_NAME, CANARY_PASSWORD, CANARY_WRONG, leaked } from "./canaries.ts";

describe("canaries typed into the account pages under a session recording", () => {
  /** The sign-up and sign-in pages, each typed with the canaries and submitted, under one recorder. */
  async function recorded() {
    const ctx = createCtx({ mode: "sim", seed: 65 });
    const rec = record(ctx, { upload: new URL("/sessions", location.origin) });
    const up = await renderRoute("accounts.signup", { routes, params: { locale: "en-US" }, ctx });
    await up.fire("accounts.signupForm:name", { type: "input", value: CANARY_NAME });
    await up.fire("accounts.signupForm:email", { type: "input", value: CANARY_EMAIL });
    await up.fire("accounts.signupForm:password", { type: "input", value: CANARY_PASSWORD });
    await up.fire("accounts.signupSubmit", { type: "click" });
    const posted = [...up.documents()];
    up.dispose();
    const signin = await renderRoute("accounts.signin", { routes, params: { locale: "en-US" }, ctx });
    await signin.fire("accounts.signinForm:email", { type: "input", value: CANARY_EMAIL });
    await signin.fire("accounts.signinForm:password", { type: "input", value: CANARY_WRONG });
    await signin.fire("accounts.signinSubmit", { type: "click" });
    signin.dispose();
    const out = rec.stop();
    const put = await session(ctx).put(new URL("/sessions", location.origin), out);
    return { out, posted, put, taken: session(ctx).taken() };
  }

  it("carried the canaries: the form posted them to the identity mount", async () => {
    const { posted, out } = await recorded();
    expect(JSON.stringify(posted)).toContain(encodeURIComponent(CANARY_EMAIL));
    expect(out.events.length).toBeGreaterThan(0);
  });

  it("sink: the recorded session", async () => {
    const { out } = await recorded();
    expect(leaked(JSON.stringify(out), CANARIES)).toEqual([]);
  });

  it("sink: the session as uploaded", async () => {
    const { put, taken } = await recorded();
    expect(put.ok).toBe(true);
    expect(taken.length).toBeGreaterThan(0);
    expect(leaked(JSON.stringify(taken), CANARIES)).toEqual([]);
  });

  it("sink: the URL of each document the pages opened", async () => {
    const { posted } = await recorded();
    for (const d of posted) {
      const url = String(Reflect.get(Object(d), "url"));
      expect({ url, leaked: leaked(new URL(url, BASE).href, CANARIES) }).toEqual({ url, leaked: [] });
    }
  });
});
