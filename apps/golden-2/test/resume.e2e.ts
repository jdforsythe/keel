// Resume of served golden-2 pages in a real browser: a copy of the app whose `web` deployable is a `node` server
// holding the `recipes` module is built, and served beside golden-2's real `api` node deployable, its app database a
// PGlite folder of the run. Two recipes are seeded through the api; the api is stopped and started again on the same
// data (both recipes are still there). Then the recipe index, a recipe's show page, the new-recipe page and the catalog
// are loaded from `web`, and the sign-in page from `api`, each with its scripts held until the test has typed into an
// input (new-recipe, sign-in) or scrolled the page (index, show, catalog); `resume()` then fails with E1720 when the
// claim replaced a served element or moved focus, a value, the caret or the scroll position. On each page one
// interaction works. A sign-in form submitted with Enter while the scripts are held sends exactly one POST. Scripts
// running, a sign-up and a sign-in through the forms each send one POST to the identity mount answered by a 303, and the
// sign-in page then names the account. The catalog is also loaded at 390px in en-US and de-DE: the document is no wider
// than the viewport and the table scrolls inside its region.
import { cp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { type Page, type Served, build, serve } from "@keel/testing/e2e";
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, beforeAll, expect, it } from "vitest";

const AUTH_SECRET = "golden-2-e2e-auth-secret-of-32-characters";
const app = resolve(import.meta.dirname, "..");
const skipped = new Set(["node_modules", "dist", ".keel", ".keel-dev", ".turbo", "reports", ".api.storage", "test"]);
let tmp = "";
let dir = "";

// The pages are served, not mounted: `web` becomes a node deployable reaching `api` as its peer.
beforeAll(async () => {
  tmp = tempDir("keel-e2e-resume-");
  dir = join(tmp, "app");
  await cp(app, dir, { recursive: true, filter: (src) => src === app || !skipped.has(basename(src)) });
  await symlink(join(app, "node_modules"), join(dir, "node_modules"), "dir");
  const topology = join(dir, "topology.ts");
  const source = await readFile(topology, "utf8");
  const node = source.replace(/web: \{[^\n]*\},\n/, 'web: { modules: ["recipes"], adapter: "node" },\n');
  expect(node).not.toBe(source);
  await writeFile(topology, node);
  await build(dir);
}, fixedTime(300_000)); // keel build of the copy

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
});

type Recipe = { readonly id: string; readonly title: string; readonly favorite?: boolean };

/** Sign up and sign in through the identity mount as the account forms post; the session cookie, "" when none is set. */
async function session(served: Served, email: string): Promise<string> {
  const mount = async (path: string, fields: Record<string, string>) =>
    (
      await served.fetch(`/api/auth${path}`, {
        method: "POST",
        deployable: "api",
        headers: {
          accept: "text/html",
          "content-type": "application/x-www-form-urlencoded",
          origin: served.origin("api"),
        },
        body: new URLSearchParams(fields).toString(),
      })
    ).headers.getSetCookie();
  const password = "resume password";
  await mount("/sign-up/email", { name: "Seed Cook", email, password });
  const cookies = await mount("/sign-in/email", { email, password });
  return cookies
    .map((c) => c.split(";", 1).join(""))
    .filter((c) => c.startsWith("better-auth.session_token="))
    .join("; ");
}

/** The recipes `GET /api/recipes` lists. */
async function recipes(served: Served): Promise<readonly Recipe[]> {
  const body: unknown = await (
    await served.fetch("/api/recipes", { deployable: "api", headers: { accept: "application/json" } })
  ).json();
  const list = path(body, ["results", "kitchen.box", "value", "recipes"]);
  return Array.isArray(list) ? list.flatMap(recipeOf) : [];
}

/** The value of `value` under the keys `keys`, undefined when one is missing. */
function path(value: unknown, keys: readonly string[]): unknown {
  let at = value;
  for (const key of keys) {
    if (typeof at !== "object" || at === null) return undefined;
    at = Reflect.get(at, key);
  }
  return at;
}

function recipeOf(value: unknown): Recipe[] {
  const id = path(value, ["id"]);
  const title = path(value, ["title"]);
  const favorite = path(value, ["favorite"]);
  return typeof id === "string" && typeof title === "string" ? [{ id, title, favorite: favorite === true }] : [];
}

/** golden-2's `api` and the copy's `web`, signed in as a seed account that posted two recipes. */
async function seeded() {
  const served = await serve({
    project: dir,
    env: (data) => ({ BETTER_AUTH_SECRET: AUTH_SECRET, KEEL_POSTGRES_URL: `pglite:${join(data, "postgres")}` }),
  });
  const cookie = await session(served, `seed-${process.pid}@example.com`);
  expect(cookie).not.toBe("");
  const statuses: number[] = [];
  for (const body of [
    { title: "Pasta bake", minutes: 30, price: { amount: 1250, currency: "EUR" } },
    { title: "Miso soup", minutes: 90, price: { amount: 1800, currency: "JPY" } },
  ])
    statuses.push(
      (
        await served.fetch("/api/recipes", {
          method: "POST",
          deployable: "api",
          headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1", cookie },
          body: JSON.stringify(body),
        })
      ).status,
    );
  const listed = await recipes(served);
  const soup = listed.find((r) => r.title === "Miso soup")?.id ?? "";
  expect(statuses).toEqual([200, 200]);
  expect(listed).toHaveLength(2);
  expect(soup).not.toBe("");
  return { served, soup };
}

/** The HTML `path` is served as, from the deployable `deployable`. */
async function served_(served: Served, path: string, deployable: string): Promise<string> {
  const res = await served.fetch(path, { deployable, headers: { accept: "text/html" } });
  expect(res.status).toBe(200);
  return res.text();
}

/** The island ids the served `html` marks, in document order. */
const islandsIn = (html: string): string[] => [...html.matchAll(/data-k-island="([^"]*)"/g)].map((m) => m[1] ?? "");

/** The text of the field error under `field`, once it shows one. */
async function errorOf(page: Page, field: string): Promise<string> {
  await page.until(`${field}:error`, { text: /\S/ });
  return (await page.find(`${field}:error`)).text;
}

/** Focus the input `id` and put its caret after the second character, as a person does. */
async function caretAt2(page: Page, id: string): Promise<void> {
  await page.fire(id, { type: "focus" });
  await page.press("Home");
  await page.press("ArrowRight");
  await page.press("ArrowRight");
}

/** The value `find` reports for the input `id`. */
async function typedIn(page: Page, id: string): Promise<unknown> {
  return (await page.find(id)).value;
}

it("recipes survive an api restart", async () => {
  const { served, soup } = await seeded();
  // The recipes are in the PGlite folder, not the process: a new api process on the same data reads them.
  await served.stop("api");
  await served.start("api");
  const kept = await recipes(served);
  expect(kept).toHaveLength(2);
  expect(kept.some((r) => r.id === soup)).toBe(true);
});

it("the recipe index resumes keeping its rows and its scroll, and a row's link opens the recipe", async () => {
  const { served, soup } = await seeded();
  const html = await served_(served, "/", "web");
  expect(html).toContain('id="recipes.shell"');
  expect(html).toContain("<!--[-->");
  const page = await served.open("/", { deployable: "web", hold: true });
  const rows = await page.findAll("recipes.item");
  expect(rows).toHaveLength(2);
  await page.scroll(200);
  await page.resume();
  expect(page.problems()).toEqual([]);
  expect(await page.findAll("recipes.item")).toHaveLength(2);
  const link = (await page.findAll("recipes.link"))[0];
  expect(link).toBeDefined();
  await page.fire(link?.id ?? "", { type: "click" });
  const at = (await page.location()).path;
  expect(at).toMatch(/^\/recipes\//);
  expect(at).toBe(`/recipes/${encodeURIComponent((link?.id ?? "").slice("recipes.link.".length))}`);
  expect(soup).not.toBe("");
});

it("the show page resumes and its favorite toggle works", async () => {
  const { served, soup } = await seeded();
  const html = await served_(served, `/recipes/${encodeURIComponent(soup)}`, "web");
  expect(islandsIn(html)).toContain("recipes.show");
  expect(html).toContain('id="recipes.toggleFavorite"');
  const page = await served.open(`/recipes/${encodeURIComponent(soup)}`, { deployable: "web", hold: true });
  await page.scroll(200);
  await page.resume();
  expect(page.problems()).toEqual([]);
  const wasStored = (await recipes(served)).find((r) => r.id === soup)?.favorite === true;
  const before = (await page.find("recipes.favorite")).text;
  await page.fire("recipes.toggleFavorite", { type: "click" });
  const after = (await page.find("recipes.favorite")).text;
  const stored = (await recipes(served)).find((r) => r.id === soup)?.favorite === true;
  expect(after).not.toBe(before);
  expect(after).not.toBe("");
  expect(stored).toBe(!wasStored);
});

it("the new-recipe page keeps the title typed before resume, and clearing it shows the field's error", async () => {
  const { served } = await seeded();
  const html = await served_(served, "/recipes/new", "web");
  expect(html).toContain('id="recipes.new"');
  expect(html).toContain('name="title"');
  expect(html).toContain('name="title"');
  const title = "recipes.draft:title";
  const page = await served.open("/recipes/new", { deployable: "web", hold: true });
  await page.fire(title, { type: "input", value: "Soup" });
  await caretAt2(page, title);
  await page.resume();
  expect(page.problems()).toEqual([]);
  expect(await typedIn(page, title)).toBe("Soup");
  // The caret survived the resume: the next key lands after the second character.
  await page.press("x");
  expect(await typedIn(page, title)).toBe("Soxup");
  await page.fire(title, { type: "input", value: "Soup" });
  await page.fire(title, { type: "input", value: "" });
  await page.fire(title, { type: "blur" });
  expect(await errorOf(page, title)).not.toBe("");
});

it("the catalog resumes keeping its scroll, and its filters disclosure opens", async () => {
  const { served } = await seeded();
  const html = await served_(served, "/catalog", "web");
  expect(html).toContain('id="recipes.catalog"');
  const page = await served.open("/catalog", { deployable: "web", hold: true });
  await page.scroll(200);
  await page.resume();
  expect(page.problems()).toEqual([]);
  const toggle = "recipes.catalogFilters.button";
  expect((await page.find(toggle)).state.expanded).toBe(false);
  await page.fire(toggle, { type: "click" });
  await page.until(toggle, { state: { expanded: true } });
});

for (const locale of ["en-US", "de-DE"]) {
  it(`the catalog at 390px in ${locale} does not scroll sideways, and its table scrolls inside its region`, async () => {
    const { served } = await seeded();
    const page = await served.open(`/${locale}/catalog`, { deployable: "web" });
    await page.viewport({ width: 390, height: 800 });
    await page.find("recipes.catalog.title");
    const region = await page.layout("recipes.table.scroll");
    expect((await page.layout()).scrollWidth).toBeLessThanOrEqual(390);
    expect(region.scrollWidth).toBeGreaterThan(region.clientWidth);
  });
}

it("the sign-in page keeps the email typed before resume, and a bad address shows the field's error", async () => {
  const { served } = await seeded();
  const html = await served_(served, "/account/signin", "api");
  expect(html).toContain('id="accounts.signin"');
  const email = "accounts.signinForm:email";
  const page = await served.open("/account/signin", { deployable: "api", hold: true });
  await page.fire(email, { type: "input", value: "cook@example.com" });
  await caretAt2(page, email);
  await page.resume();
  expect(page.problems()).toEqual([]);
  expect(await typedIn(page, email)).toBe("cook@example.com");
  // The caret survived the resume: the next key lands after the second character.
  await page.press("x");
  expect(await typedIn(page, email)).toBe("coxok@example.com");
  await page.fire(email, { type: "input", value: "cook@example.com" });
  await page.fire(email, { type: "input", value: "x" });
  await page.fire(email, { type: "blur" });
  expect(await errorOf(page, email)).not.toBe("");
});

it("a submit before the island resumes goes to the server once", async () => {
  const { served } = await seeded();
  const page = await served.open("/account/signin", { deployable: "api", hold: true });
  await page.fire("accounts.signinForm:email", { type: "input", value: "cook@example.com" });
  await page.fire("accounts.signinForm:password", { type: "input", value: "not-the-password" });
  await page.press("Enter");
  await page.settle();
  expect(page.requests().filter((r) => r.method === "POST")).toHaveLength(1);
});

it("a sign-up and a sign-in through the forms each post once and follow a 303, and the page names the account", async () => {
  const { served } = await seeded();
  const who = `cook${process.pid}@example.com`;
  const page = await served.open("/account/signup", { deployable: "api" });
  await page.fire("accounts.signupForm:name", { type: "input", value: "Smoke Cook" });
  await page.fire("accounts.signupForm:email", { type: "input", value: who });
  await page.fire("accounts.signupForm:password", { type: "input", value: "smoke password" });
  await page.fire("accounts.signupSubmit", { type: "click" });
  const posts = () =>
    page
      .requests()
      .filter((r) => r.method === "POST")
      .map((r) => new URL(r.url).pathname);
  expect(posts()).toEqual(["/api/auth/sign-up/email"]);
  expect((await page.location()).path).toBe("/account/signin");
  await page.fire("accounts.signinForm:email", { type: "input", value: who });
  await page.fire("accounts.signinForm:password", { type: "input", value: "smoke password" });
  await page.fire("accounts.signinSubmit", { type: "click" });
  expect(posts()).toEqual(["/api/auth/sign-up/email", "/api/auth/sign-in/email"]);
  expect(page.problems()).toEqual([]);
  const docs = await page.documents();
  expect(docs.filter((d) => d.status === 303).map((d) => new URL(d.url).pathname)).toEqual([
    "/api/auth/sign-up/email",
    "/api/auth/sign-in/email",
  ]);
  expect((await page.find("accounts.signedIn")).text).toContain(who);
});
