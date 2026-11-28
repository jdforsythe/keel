// The built `api` serves the shell's client at the guarded path, refuses `/api/me` signed out, answers a sign-in post
// to the identity mount with a 303 to its `next` and a cookie, then names the user; the Tauri files register the
// shell's id as a deep-link scheme.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { serve } from "@keel/testing/e2e";
import { expect, it } from "vitest";

it("api serves the client, refuses a signed-out user, signs one in through the mount and names them", async () => {
  const app = await serve();
  const html = { accept: "text/html" };

  const page = await app.fetch("/notes/n1", { headers: html });
  expect(page.status).toBe(200);
  expect(await page.text()).toContain('id="app"');

  const me = (cookie?: string): Promise<Response> =>
    app.fetch("/api/me", { headers: { accept: "application/json", ...(cookie === undefined ? {} : { cookie }) } });
  expect((await me()).status).toBe(403);

  const signin = await app.fetch("/api/auth/sign-in/email?next=%2Fnotes%2Fn1", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: app.origin() },
    body: "name=Ada",
  });
  expect(signin.status).toBe(303);
  expect(signin.headers.get("location")).toBe("/notes/n1");
  const cookie = signin.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

  const named = await me(cookie);
  expect(named.status).toBe(200);
  expect(JSON.stringify(await named.json())).toContain('"name":"Ada"');

  const conf = await readFile(join(import.meta.dirname, "..", "deploy", "web", "tauri", "tauri.conf.json"), "utf8");
  expect(conf).toContain('"schemes": ["dev.keel.shellmount"]');
});
