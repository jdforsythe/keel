// What the household's end-to-end files share: starting the built `web` deployable with its app data in PGlite under
// the run's data folder, signing a member up and in through the pages, and reading the API as a signed-in page.
import { type Page, type Served, serve } from "@keel/testing/e2e";

/** The password every test member signs up with. */
export const PASSWORD = "smoke test passphrase";
/** The request headers of an API call that answers JSON and carries the header an API write needs. */
export const json = { accept: "application/json", "content-type": "application/json", "x-keel": "1" };
/** The request headers of a read the API answers as JSON. */
export const read = { accept: "application/json" };

/** The environment of the built app: the sign-in library's secret and app data in PGlite under `data`. */
export const environment = (data: string): Record<string, string> => ({
  // The project's vitest config sets `AUTH_FIXTURE=test` (a fixed secret and an in-memory sign-in database) for the
  // page tests, and the built servers inherit it: empty here, the sign-in database is the file beside the storage.
  AUTH_FIXTURE: "",
  BETTER_AUTH_SECRET: "household-e2e-auth-secret-of-32-characters",
  KEEL_POSTGRES_URL: `pglite:${data}/postgres`,
});

/** The household served on a free port, with the folder its data lives in. */
export async function household(
  env?: (data: string) => Record<string, string>,
): Promise<{ served: Served; data: string }> {
  let folder = "";
  const served = await serve({
    env: (data) => {
      folder = data;
      return env === undefined ? environment(data) : env(data);
    },
  });
  return { served, data: folder };
}

/** Sign `page` up from `/signup` and in from the sign-in page it lands on; it ends on the page it goes on to. */
export async function signUpAndIn(page: Page, name: string, email: string): Promise<void> {
  await page.fire("members.signupForm:name", { type: "input", value: name });
  await page.fire("members.signupForm:email", { type: "input", value: email });
  await page.fire("members.signupForm:password", { type: "input", value: PASSWORD });
  await page.fire("members.signupSubmit", { type: "click" });
  await signIn(page, email);
}

/** Sign in on `page`, which is on the sign-in page. */
export async function signIn(page: Page, email: string): Promise<void> {
  await page.fire("members.signinForm:email", { type: "input", value: email });
  await page.fire("members.signinForm:password", { type: "input", value: PASSWORD });
  await page.fire("members.signinSubmit", { type: "click" });
}

/** A page of a new member, on `/list` once its change stream says Live. */
export async function member(served: Served, name: string, email: string): Promise<Page> {
  const page = await served.open("/signup");
  await signUpAndIn(page, name, email);
  await page.navigate("/list");
  await page.until("shopping.live", { text: /^Live/ });
  return page;
}

/** An item of the list as `GET /api/items` answers it. */
export type Item = { id: string; name: string; qty: number; bought: boolean };

/** The list as `GET /api/items` answers it with `headers` (a cookie of `page`, or a bearer token with `served`). */
export async function itemsOf(res: Response): Promise<Item[]> {
  const body: unknown = await res.json();
  return listOf(body);
}

/** The items inside an API answer. */
function listOf(body: unknown): Item[] {
  if (typeof body !== "object" || body === null) throw new Error("the items answer is not an object");
  const results: unknown = Reflect.get(body, "results");
  const entry: unknown =
    typeof results === "object" && results !== null ? Reflect.get(results, "shopping.items") : undefined;
  const value: unknown = typeof entry === "object" && entry !== null ? Reflect.get(entry, "value") : undefined;
  const items: unknown = typeof value === "object" && value !== null ? Reflect.get(value, "items") : undefined;
  if (!Array.isArray(items)) throw new Error("the items answer holds no list");
  return items.map((i: unknown) => {
    if (typeof i !== "object" || i === null) throw new Error("an item is not an object");
    const id = Reflect.get(i, "id");
    const name = Reflect.get(i, "name");
    const qty = Reflect.get(i, "qty");
    const bought = Reflect.get(i, "bought");
    if (typeof id !== "string" || typeof name !== "string" || typeof qty !== "number" || typeof bought !== "boolean")
      throw new Error("an item has the wrong shape");
    return { id, name, qty, bought };
  });
}

/** The household name `GET /api/household` answers, or the answer's status as text. */
export async function householdName(res: Response): Promise<string> {
  if (res.status !== 200) return `status ${res.status}`;
  const body: unknown = await res.json();
  const results: unknown = typeof body === "object" && body !== null ? Reflect.get(body, "results") : undefined;
  const entry: unknown =
    typeof results === "object" && results !== null ? Reflect.get(results, "setup.household") : undefined;
  const value: unknown = typeof entry === "object" && entry !== null ? Reflect.get(entry, "value") : undefined;
  const name: unknown = typeof value === "object" && value !== null ? Reflect.get(value, "name") : undefined;
  return typeof name === "string" ? name : "no name";
}

/** The weekly staples run's record as `GET /api/restock` answers it. */
export type Runs = { kept: number; last: { state: string; handled: number; total: number; putBack: number } | null };

/** The runs inside an API answer. */
export async function runsOf(res: Response): Promise<Runs> {
  const body: unknown = await res.json();
  const results: unknown = typeof body === "object" && body !== null ? Reflect.get(body, "results") : undefined;
  const entry: unknown =
    typeof results === "object" && results !== null ? Reflect.get(results, "shopping.runs") : undefined;
  const value: unknown = typeof entry === "object" && entry !== null ? Reflect.get(entry, "value") : undefined;
  if (typeof value !== "object" || value === null) throw new Error("the runs answer holds no value");
  const kept = Reflect.get(value, "kept");
  const last: unknown = Reflect.get(value, "last");
  if (typeof kept !== "number") throw new Error("the runs answer holds no count");
  if (last === null) return { kept, last: null };
  if (typeof last !== "object") throw new Error("the last run is not an object");
  const state = Reflect.get(last, "state");
  const handled = Reflect.get(last, "handled");
  const total = Reflect.get(last, "total");
  const putBack = Reflect.get(last, "putBack");
  if (
    typeof state !== "string" ||
    typeof handled !== "number" ||
    typeof total !== "number" ||
    typeof putBack !== "number"
  )
    throw new Error("the last run has the wrong shape");
  return { kept, last: { state, handled, total, putBack } };
}

/** The list's three rules: at most 50 items, unique ids, one open item per name. */
export function holds(items: readonly Item[]): boolean {
  const open = items.filter((i) => !i.bought).map((i) => i.name);
  return (
    items.length <= 50 && new Set(items.map((i) => i.id)).size === items.length && new Set(open).size === open.length
  );
}

/**
 * The problems of `page` that are not a request the page lost with its server or its network (the browser's own
 * network errors are console errors): each as `kind: text`. A test that stops its server or takes the page offline
 * takes them here; whatever else is left is returned and, untaken, fails the test with E1738.
 */
export function unexpected(page: Page): string[] {
  page.problems({ kind: "console", text: /^Failed to load resource/ });
  return page.problems().map((p) => `${p.kind}: ${p.text}`);
}

/** The texts of the list's rows on `page`. */
export async function rows(page: Page): Promise<string[]> {
  return (await page.findAll("shopping.name")).map((r) => r.text);
}

/** The id of the row of the item named `name` on the list's API answer, once it has been added. */
export async function idOf(page: Page, name: string): Promise<string> {
  const item = (await itemsOf(await page.fetch("/api/items", { headers: read }))).find((i) => i.name === name);
  if (item === undefined) throw new Error(`no item ${name}`);
  return item.id;
}

/** The staples of the list's menu, in the order it shows them. */
export const staples = ["milk", "bread", "eggs", "rice", "apples"] as const;

/** Add `staple` through the list's menu: open it from its button and choose the staple. */
export async function addStaple(page: Page, staple: (typeof staples)[number]): Promise<void> {
  await page.fire("shopping.staples.trigger", { type: "click" });
  await page.fire(`shopping.staples.item.${staple}`, { type: "click" });
}

/** Show the list's Bought tab. */
export async function showBought(page: Page): Promise<void> {
  await page.fire("shopping.view.tab.bought", { type: "click" });
}
