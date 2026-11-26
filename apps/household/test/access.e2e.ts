// The built household in a real browser: the start page and its stylesheet, the guard that sends the list to
// sign-in, sign-up and sign-in, the session cookie's flags, the setup action, the list through the API and a reload,
// the API's refusals (no member, a forged origin), the receipt form and a minted token.
import type { Page } from "@keel/testing/e2e";
import { expect, it } from "vitest";
import {
  PASSWORD,
  addStaple,
  household,
  householdName,
  idOf,
  itemsOf,
  json,
  member,
  read,
  rows,
  signIn,
} from "./householdApp.ts";

/** Fill the receipt form with a shop and an amount and submit it. */
async function receipt(page: Page, amount: string): Promise<void> {
  await page.fire("receipts.new:shop", { type: "input", value: "Market" });
  await page.fire("receipts.new:amount", { type: "input", value: amount });
  await page.fire("receipts.save", { type: "click" });
}

/** What the page shows of a receipt the server rejected: the typed values, the invalid mark and the error text. */
async function shown(page: Page) {
  const amount = await page.find("receipts.new:amount");
  return {
    shop: (await page.find("receipts.new:shop")).value,
    amount: amount.value,
    invalid: amount.state.invalid,
    error: (await page.find("receipts.new:amount:error")).text,
  };
}

it("the start page links its stylesheet, the guard sends the list to sign-in, and sign-up and sign-in go on to the list", async () => {
  const { served } = await household();
  const page = await served.open("/");
  // The stylesheet the document requests is served as css.
  const sheets = page.requests().filter((r) => new URL(r.url).pathname.endsWith(".css"));
  expect(sheets.length).toBeGreaterThan(0);
  for (const sheet of sheets) {
    const answer = await served.fetch(new URL(sheet.url).pathname);
    expect(answer.status).toBe(200);
    expect(answer.headers.get("content-type") ?? "").toMatch(/^text\/css/);
  }

  await page.fire("app.start.toList", { type: "click" });
  expect((await page.location()).path).toBe("/signin?next=%2Flist");
  await page.fire("members.toSignup", { type: "click" });
  await page.fire("members.signupForm:name", { type: "input", value: "Ada Lovelace" });
  await page.fire("members.signupForm:email", { type: "input", value: "ada@example.com" });
  await page.fire("members.signupForm:password", { type: "input", value: PASSWORD });
  await page.fire("members.signupSubmit", { type: "click" });
  expect((await page.location()).path).toMatch(/^\/signin/);
  await signIn(page, "ada@example.com");
  expect((await page.location()).path).toBe("/list");
  expect(page.problems()).toEqual([]);
});

it("the session cookie is HttpOnly and SameSite=Lax", async () => {
  const { served } = await household();
  const page = await member(served, "Ada Lovelace", "ada@example.com");
  const cookies = await page.cookies();
  expect(cookies.some((c) => c.name.includes("session") && c.httpOnly && c.sameSite === "Lax")).toBe(true);
  expect(page.problems()).toEqual([]);
});

it("the setup action writes the name, the frame sets the brand serif, and the list takes the menu and keeps it through a reload", async () => {
  const { served } = await household();
  const page = await member(served, "Ada Lovelace", "ada@example.com");

  await page.navigate("/setup");
  await page.fire("setup.form:name", { type: "input", value: "Elm Street" });
  await page.fire("setup.save", { type: "click" });
  await page.until("setup.done", { text: /\S/ });
  const named = await page.fetch("/api/household", { headers: read });
  expect(named.status).toBe(200);
  expect(await householdName(named)).toBe("Elm Street");

  await page.navigate("/receipts");
  expect((await page.style("frame", ["font-family"]))["font-family"] ?? "").toMatch(/^"?Source Serif 4"?/);
  // The face the frame names is requested and served.
  const faces = page.requests().filter((r) => new URL(r.url).pathname.endsWith(".woff2"));
  expect(faces.length).toBeGreaterThan(0);
  for (const face of faces) expect((await served.fetch(new URL(face.url).pathname)).status).toBe(200);

  await page.navigate("/list");
  await page.until("shopping.live", { text: /^Live/ });
  await addStaple(page, "milk");
  await addStaple(page, "milk");
  const milk = await idOf(page, "Milk");
  await page.until(`shopping.name.${milk}`, { text: "Milk × 2" });
  await page.reload();
  expect((await page.find(`shopping.name.${milk}`)).text).toBe("Milk × 2");
  await page.fire("shopping.help.button", { type: "click" });
  expect((await page.find("shopping.help.button")).state.expanded).toBe(true);

  const write = await page.fetch("/api/items", {
    method: "POST",
    headers: json,
    body: JSON.stringify({ name: "Eggs" }),
  });
  expect(write.status).toBe(200);
  const listed = await itemsOf(await page.fetch("/api/items", { headers: read }));
  expect(listed.map((i) => i.name)).toContain("Eggs");
  await page.navigate("/list");
  const names = (await rows(page)).join(",");
  expect(names).toContain("Eggs");
  expect(names).toContain("Milk");
  expect(page.problems()).toEqual([]);
});

it("the API refuses a request no member made and a write from a forged origin, and writes nothing", async () => {
  const { served } = await household();
  const page = await member(served, "Ada Lovelace", "ada@example.com");
  expect((await served.fetch("/api/items", { headers: read })).status).toBe(403);

  const forged = { origin: "https://evil.example", "sec-fetch-site": "cross-site" };
  const form = await served.fetch("/setup", {
    method: "POST",
    headers: { ...forged, "content-type": "application/x-www-form-urlencoded", accept: "text/html" },
    body: "name=Intruder",
  });
  const api = await served.fetch("/api/items", {
    method: "POST",
    headers: { ...forged, "content-type": "application/json", accept: "*/*" },
    body: JSON.stringify({ name: "Intruder" }),
  });
  expect(form.status).toBe(403);
  expect(api.status).toBe(403);
  const items = await (await page.fetch("/api/items", { headers: read })).text();
  const who = await (await page.fetch("/api/household", { headers: read })).text();
  expect(items).not.toContain("Intruder");
  expect(who).not.toContain("Intruder");
  expect(page.problems()).toEqual([]);
});

it("a receipt form records a receipt, and a rejected one keeps the typed values and shows the error", async () => {
  const { served } = await household();
  const page = await member(served, "Ada Lovelace", "ada@example.com");
  await page.navigate("/receipts");
  await receipt(page, "3.5");
  const totals = (await page.findAll("receipts.total")).map((t) => t.text);
  expect(totals).toContain("€3.50");

  await receipt(page, "3.555");
  const on = await shown(page);
  expect(on).toMatchObject({ shop: "Market", amount: "3.555", invalid: true });
  expect(on.error).not.toBe("");
  // The browser reports the 422 the form was answered with as a console error.
  expect(page.problems().map((p) => p.text)).toEqual([
    "Failed to load resource: the server responded with a status of 422 (Unprocessable Entity)",
  ]);
});

it("a rejected form keeps the typed values and shows the error, and the setup saves, with scripts off", async () => {
  const { served } = await household();
  await member(served, "Ada Lovelace", "ada@example.com");
  // A second context with scripts off: the sign-in, the setup and the receipt form go through native form posts.
  const bare = await served.open("/setup", { scripts: false });
  await signIn(bare, "ada@example.com");
  await bare.fire("setup.form:name", { type: "input", value: "Oak Road" });
  await bare.fire("setup.save", { type: "click" });
  await bare.until("setup.done", { text: /\S/ });
  expect(await householdName(await bare.fetch("/api/household", { headers: read }))).toBe("Oak Road");
  await bare.navigate("/receipts");
  await receipt(bare, "3.555");
  const off = await shown(bare);
  expect(off).toMatchObject({ shop: "Market", amount: "3.555", invalid: true });
  expect(off.error).not.toBe("");
  expect(bare.problems().filter((p) => p.kind !== "console")).toEqual([]);
});

it("a minted token calls the API as the member, and a revoked one is refused", async () => {
  const { served } = await household();
  const page = await member(served, "Ada Lovelace", "ada@example.com");
  await page.fetch("/api/items", { method: "POST", headers: json, body: JSON.stringify({ name: "Milk" }) });
  await page.navigate("/profile");
  await page.fire("members.mint", { type: "click" });
  const token = (await page.find("members.minted")).text.trim();
  await page.find("members.token.0");
  const bearer = { accept: "application/json", authorization: `Bearer ${token}` };
  const called = await served.fetch("/api/items", { headers: bearer });
  expect(token.startsWith("keel_")).toBe(true);
  expect(called.status).toBe(200);
  expect((await itemsOf(called)).some((i) => i.name === "Milk")).toBe(true);

  await page.fire("members.revoke.0", { type: "click" });
  await page.find("members.tokens.none");
  expect((await served.fetch("/api/items", { headers: bearer })).status).toBe(403);
  expect(page.problems()).toEqual([]);
});
