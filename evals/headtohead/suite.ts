// The hidden acceptance suite of the head-to-head (evals/headtohead/brief/BRIEF.md): black-box, over HTTP and Chromium,
// against a URL. It never imports an app and is never copied into an arm's directory, so the same checks score both
// arms. Checks run in order against one server that starts with an empty box; each opens its own browser context.
import { type Browser, type BrowserContext, type Page, chromium, expect } from "@playwright/test";

export type CheckResult = { name: string; passed: boolean; reason: string };
export type Acceptance = { passed: number; total: number; results: CheckResult[] };

type Env = { origin: string; browser: Browser; pageErrors: string[] };
type Check = { name: string; run: (env: Env) => Promise<void> };
type Draft = { title: string; minutes: number; amount: number; currency: string };

const STEP_MS = 6_000;

/** The element with this exact id (ids hold dots and colons). */
const byId = (page: Page, id: string) => page.locator(`[id="${id}"]`);
/** Whitespace as one space, no-break spaces included, so copy compares the way a person reads it. */
const norm = (s: string | null): string => (s ?? "").replace(/[\s  ]+/g, " ").trim();
const prefix = (locale: string): string => (locale === "en-US" ? "" : `/${locale}`);

async function open(env: Env): Promise<{ context: BrowserContext; page: Page }> {
  const context = await env.browser.newContext();
  context.setDefaultTimeout(STEP_MS);
  const page = await context.newPage();
  page.on("pageerror", (e) => env.pageErrors.push(String(e).split("\n")[0] ?? "page error"));
  return { context, page };
}

async function textIs(page: Page, id: string, want: string): Promise<void> {
  const loc = byId(page, id);
  await loc.first().waitFor({ state: "attached", timeout: STEP_MS });
  await expect
    .poll(async () => norm(await loc.first().textContent()), { timeout: STEP_MS, message: id })
    .toBe(norm(want));
}

async function create(env: Env, d: Draft): Promise<void> {
  const { context, page } = await open(env);
  try {
    await page.goto(`${env.origin}/recipes/new`);
    await byId(page, "recipes.draft:title").fill(d.title);
    await byId(page, "recipes.draft:minutes").fill(String(d.minutes));
    await byId(page, "recipes.draft:price.amount").fill(String(d.amount));
    await byId(page, "recipes.draft:price.currency").selectOption(d.currency);
    await byId(page, "recipes.save").click();
    await expect(page).toHaveURL(`${env.origin}/`, { timeout: STEP_MS });
  } finally {
    await context.close();
  }
}

/** The id the server minted for `title`, read from the list. */
async function idOf(env: Env, title: string): Promise<string> {
  const { context, page } = await open(env);
  try {
    await page.goto(`${env.origin}/`);
    const link = page.locator('[id^="recipes.link."]', { hasText: title }).first();
    await link.waitFor({ state: "attached", timeout: STEP_MS });
    const id = (await link.getAttribute("id")) ?? "";
    return id.slice("recipes.link.".length);
  } finally {
    await context.close();
  }
}

const today = (locale: string): string =>
  new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date());

const COPY = {
  "en-US": {
    list: "Recipes · Keel",
    fresh: "New recipe · Keel",
    home: "Recipes",
    newLink: "New recipe",
    favorites: "Favorites",
    count2: "2 recipes",
    count1: "1 recipe",
    pasta: "€12.50",
    miso: "¥1,800",
    m30: "30 min",
    m90: "1 hr, 30 min",
    fav: "Favorite",
    notFav: "Not favorite",
    toggle: "Toggle favorite",
    added: (d: string) => `Added ${d}`,
    errEmpty: "1 to 80 characters on one line",
    errDup: "Already in the box",
    showTitle: (t: string) => `${t} · Recipes`,
  },
  "de-DE": {
    list: "Rezepte · Keel",
    fresh: "Neues Rezept · Keel",
    home: "Rezepte",
    newLink: "Neues Rezept",
    favorites: "Favoriten",
    count2: "2 Rezepte",
    count1: "1 Rezept",
    pasta: "12,50 €",
    miso: "1.800 ¥",
    m30: "30 Min.",
    m90: "1 Std., 30 Min.",
    fav: "Favorit",
    notFav: "Kein Favorit",
    toggle: "Favorit umschalten",
    added: (d: string) => `Hinzugefügt am ${d}`,
    errEmpty: "1 bis 80 Zeichen in einer Zeile",
    errDup: "Schon in der Sammlung",
    showTitle: (t: string) => `${t} · Rezepte`,
  },
  "ja-JP": {
    list: "レシピ · Keel",
    fresh: "新しいレシピ · Keel",
    home: "レシピ",
    newLink: "新しいレシピ",
    favorites: "お気に入り",
    count2: "2 件のレシピ",
    count1: "1 件のレシピ",
    pasta: "€12.50",
    miso: "￥1,800",
    m30: "30 分",
    m90: "1 時間 30 分",
    fav: "お気に入り",
    notFav: "お気に入りではありません",
    toggle: "お気に入りを切り替え",
    added: (d: string) => `${d}に追加`,
    errEmpty: "1〜80文字で、1行で入力してください",
    errDup: "すでに登録されています",
    showTitle: (t: string) => `${t} · レシピ`,
  },
} as const;
type Locale = keyof typeof COPY;
const LOCALES: readonly Locale[] = ["en-US", "de-DE", "ja-JP"];

const PASTA: Draft = { title: "Pasta bake", minutes: 30, amount: 1250, currency: "EUR" };
const MISO: Draft = { title: "Miso soup", minutes: 90, amount: 1800, currency: "JPY" };
const FILLERS: readonly Draft[] = [1, 2, 3, 4, 5].map((n) => ({
  title: `Filler ${n}`,
  minutes: 10 * n + 1,
  amount: 100 * n,
  currency: "EUR",
}));

async function listCopy(env: Env, locale: Locale): Promise<void> {
  const c = COPY[locale];
  const { context, page } = await open(env);
  try {
    await page.goto(`${env.origin}${prefix(locale) || "/"}`);
    await expect(page).toHaveTitle(c.list, { timeout: STEP_MS });
    await expect(page.locator("html")).toHaveAttribute("lang", locale, { timeout: STEP_MS });
    await textIs(page, "recipes.list.title", c.home);
    await textIs(page, "recipes.home", c.home);
    await textIs(page, "recipes.newLink", c.newLink);
    await textIs(page, "recipes.filter.favorites", c.favorites);
    await textIs(page, "recipes.count", c.count2);
    const pasta = await idOf(env, PASTA.title);
    const miso = await idOf(env, MISO.title);
    await textIs(page, `recipes.price.${pasta}`, c.pasta);
    await textIs(page, `recipes.price.${miso}`, c.miso);
    await textIs(page, `recipes.minutes.${pasta}`, c.m30);
    await textIs(page, `recipes.minutes.${miso}`, c.m90);
    await textIs(page, `recipes.added.${pasta}`, today(locale));
    await textIs(page, `recipes.link.${pasta}`, PASTA.title);
  } finally {
    await context.close();
  }
}

async function showCopy(env: Env, locale: Locale): Promise<void> {
  const c = COPY[locale];
  const id = await idOf(env, PASTA.title);
  const { context, page } = await open(env);
  try {
    await page.goto(`${env.origin}${prefix(locale)}/recipes/${id}`);
    await expect(page).toHaveTitle(c.showTitle(PASTA.title), { timeout: STEP_MS });
    await expect(page.locator("html")).toHaveAttribute("lang", locale, { timeout: STEP_MS });
    await textIs(page, "recipes.title", PASTA.title);
    await textIs(page, "recipes.price", c.pasta);
    await textIs(page, "recipes.minutes", c.m30);
    await textIs(page, "recipes.addedOn", c.added(today(locale)));
    await textIs(page, "recipes.favorite", c.notFav);
    await textIs(page, "recipes.toggleFavorite", c.toggle);
  } finally {
    await context.close();
  }
}

async function titleError(env: Env, locale: Locale, title: string, want: string): Promise<void> {
  const { context, page } = await open(env);
  try {
    await page.goto(`${env.origin}${prefix(locale)}/recipes/new`);
    await expect(page).toHaveTitle(COPY[locale].fresh, { timeout: STEP_MS });
    await byId(page, "recipes.draft:title").fill(title);
    await byId(page, "recipes.draft:minutes").fill("20");
    await byId(page, "recipes.draft:price.amount").fill("500");
    await byId(page, "recipes.draft:price.currency").selectOption("EUR");
    await byId(page, "recipes.save").click();
    await textIs(page, "recipes.draft:title:error", want);
    expect(new URL(page.url()).pathname).toBe(`${prefix(locale)}/recipes/new`);
  } finally {
    await context.close();
  }
}

/** The titles in the catalog table's current rows, in order. */
async function rows(page: Page): Promise<string[]> {
  const cells = page.locator('[id^="recipes.table.cell."][id$=".title"]');
  await page.locator('[id="recipes.table.status"]').waitFor({ state: "attached", timeout: STEP_MS });
  return (await cells.allTextContents()).map(norm);
}

async function rowsAre(page: Page, want: readonly string[]): Promise<void> {
  await expect.poll(() => rows(page), { timeout: STEP_MS }).toEqual([...want]);
}

/** Opens the shopping-list tab by pointer, else by the arrow key of the tabs pattern (a tab that ignores a click still counts as reachable). */
async function openListTab(page: Page): Promise<void> {
  const tab = byId(page, "recipes.views.tab.list");
  await tab.click();
  const selected = (): Promise<string | null> => tab.getAttribute("aria-selected");
  if ((await selected()) === "true") return;
  await page.waitForTimeout(500);
  if ((await selected()) === "true") return;
  await byId(page, "recipes.views.tab.recipes").focus();
  await page.keyboard.press("ArrowRight");
  await expect(tab).toHaveAttribute("aria-selected", "true", { timeout: STEP_MS });
}

const CHECKS: readonly Check[] = [
  {
    name: "http.document",
    async run(env) {
      const res = await fetch(`${env.origin}/`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type") ?? "").toContain("text/html");
    },
  },
  {
    name: "list.empty",
    async run(env) {
      const { context, page } = await open(env);
      try {
        await page.goto(`${env.origin}/`);
        await expect(page).toHaveTitle("Recipes · Keel", { timeout: STEP_MS });
        await expect(byId(page, "recipes.empty")).toBeVisible();
        await expect(page.locator('[id^="recipes.item."]')).toHaveCount(0);
      } finally {
        await context.close();
      }
    },
  },
  {
    name: "new.invalid-sends-nothing",
    async run(env) {
      const { context, page } = await open(env);
      try {
        await page.goto(`${env.origin}/recipes/new`);
        await byId(page, "recipes.save").click();
        await textIs(page, "recipes.draft:title:error", COPY["en-US"].errEmpty);
        expect(new URL(page.url()).pathname).toBe("/recipes/new");
        await expect(byId(page, "recipes.draft:title")).toBeFocused({ timeout: STEP_MS });
        await page.goto(`${env.origin}/`);
        await expect(byId(page, "recipes.empty")).toBeVisible();
      } finally {
        await context.close();
      }
    },
  },
  {
    name: "new.fields-have-labels",
    async run(env) {
      const { context, page } = await open(env);
      try {
        await page.goto(`${env.origin}/recipes/new`);
        for (const f of ["title", "minutes", "price.amount", "price.currency"]) {
          const field = byId(page, `recipes.draft:${f}`);
          await field.waitFor({ state: "attached", timeout: STEP_MS });
          const named = await field.evaluate((el) => {
            const labels = el instanceof HTMLInputElement || el instanceof HTMLSelectElement ? el.labels : null;
            return (labels?.length ?? 0) > 0 || el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby");
          });
          expect(named, `${f} has a label`).toBe(true);
        }
      } finally {
        await context.close();
      }
    },
  },
  {
    name: "new.create-and-redirect",
    async run(env) {
      await create(env, PASTA);
      await create(env, MISO);
      const { context, page } = await open(env);
      try {
        await page.goto(`${env.origin}/`);
        await expect(page.locator('[id^="recipes.link."]')).toHaveCount(2, { timeout: STEP_MS });
      } finally {
        await context.close();
      }
    },
  },
  {
    name: "new.duplicate-title-en",
    run: (env) => titleError(env, "en-US", "PASTA bake", COPY["en-US"].errDup),
  },
  {
    name: "new.duplicate-title-de",
    run: (env) => titleError(env, "de-DE", "pasta BAKE", COPY["de-DE"].errDup),
  },
  {
    name: "new.too-long-title",
    run: (env) => titleError(env, "en-US", "x".repeat(81), COPY["en-US"].errEmpty),
  },
  ...LOCALES.map<Check>((l) => ({ name: `list.copy.${l}`, run: (env) => listCopy(env, l) })),
  ...LOCALES.map<Check>((l) => ({ name: `show.copy.${l}`, run: (env) => showCopy(env, l) })),
  {
    name: "show.unknown-id",
    async run(env) {
      const { context, page } = await open(env);
      try {
        await page.goto(`${env.origin}/recipes/no-such-id`);
        await expect(byId(page, "recipes.error")).toBeVisible({ timeout: STEP_MS });
        await expect(byId(page, "recipes.title")).toHaveCount(0);
      } finally {
        await context.close();
      }
    },
  },
  {
    name: "favorite.toggle-persists-and-filters",
    async run(env) {
      const id = await idOf(env, PASTA.title);
      const { context, page } = await open(env);
      try {
        await page.goto(`${env.origin}/recipes/${id}`);
        await textIs(page, "recipes.favorite", "Not favorite");
        await byId(page, "recipes.toggleFavorite").click();
        await textIs(page, "recipes.favorite", "Favorite");
        await page.reload();
        await textIs(page, "recipes.favorite", "Favorite");
        await page.goto(`${env.origin}/`);
        await byId(page, "recipes.filter.favorites").click();
        await textIs(page, "recipes.count", "1 recipe");
        await expect(page.locator('[id^="recipes.link."]')).toHaveCount(1);
        await textIs(page, `recipes.link.${id}`, PASTA.title);
      } finally {
        await context.close();
      }
    },
  },
  {
    name: "favorite.shared-between-visitors",
    async run(env) {
      const id = await idOf(env, PASTA.title);
      const { context, page } = await open(env);
      try {
        await page.goto(`${env.origin}/de-DE/recipes/${id}`);
        await textIs(page, "recipes.favorite", COPY["de-DE"].fav);
      } finally {
        await context.close();
      }
    },
  },
  {
    name: "locale.switcher",
    async run(env) {
      const { context, page } = await open(env);
      try {
        await page.goto(`${env.origin}/`);
        await textIs(page, "recipes.list.title", "Recipes");
        for (const [l, href] of [
          ["en-US", "/"],
          ["de-DE", "/de-DE"],
          ["ja-JP", "/ja-JP"],
        ] as const) {
          const link = byId(page, `recipes.locale.${l}`);
          await expect(link).toHaveAttribute("lang", l);
          expect(new URL((await link.getAttribute("href")) ?? "", env.origin).pathname).toBe(href);
        }
        await byId(page, "recipes.locale.de-DE").click();
        await expect(page).toHaveURL(`${env.origin}/de-DE`, { timeout: STEP_MS });
        await textIs(page, "recipes.list.title", "Rezepte");
        await expect(page.locator("html")).toHaveAttribute("lang", "de-DE");
        await byId(page, "recipes.locale.ja-JP").click();
        await textIs(page, "recipes.list.title", "レシピ");
        await byId(page, "recipes.newLink").click();
        await expect(page).toHaveURL(`${env.origin}/ja-JP/recipes/new`, { timeout: STEP_MS });
        await expect(page).toHaveTitle(COPY["ja-JP"].fresh);
      } finally {
        await context.close();
      }
    },
  },
  {
    name: "nav.client-navigation",
    async run(env) {
      const id = await idOf(env, MISO.title);
      const { context, page } = await open(env);
      try {
        await page.goto(`${env.origin}/de-DE`);
        await byId(page, `recipes.link.${id}`).click();
        await expect(page).toHaveURL(`${env.origin}/de-DE/recipes/${id}`, { timeout: STEP_MS });
        await textIs(page, "recipes.title", MISO.title);
        await byId(page, "recipes.home").click();
        await expect(page).toHaveURL(`${env.origin}/de-DE`, { timeout: STEP_MS });
      } finally {
        await context.close();
      }
    },
  },
  {
    name: "url.en-US-prefix-redirects",
    async run(env) {
      const id = await idOf(env, MISO.title);
      const { context, page } = await open(env);
      try {
        await page.goto(`${env.origin}/en-US`);
        await expect(page).toHaveURL(`${env.origin}/`, { timeout: STEP_MS });
        await page.goto(`${env.origin}/en-US/recipes/${id}`);
        await expect(page).toHaveURL(`${env.origin}/recipes/${id}`, { timeout: STEP_MS });
        await textIs(page, "recipes.title", MISO.title);
      } finally {
        await context.close();
      }
    },
  },
  {
    name: "url.unknown-locale-lists-nothing",
    async run(env) {
      const { context, page } = await open(env);
      try {
        const res = await page.goto(`${env.origin}/fr-FR`);
        await page.waitForLoadState("networkidle");
        await expect(byId(page, "recipes.list.title")).toHaveCount(0);
        await expect(page.locator('[id^="recipes.link."]')).toHaveCount(0);
        expect([200, 404]).toContain(res?.status());
      } finally {
        await context.close();
      }
    },
  },
  {
    name: "catalog.seed-and-page",
    async run(env) {
      for (const f of FILLERS) await create(env, f);
      const { context, page } = await open(env);
      try {
        await page.goto(`${env.origin}/catalog`);
        await expect(page).toHaveTitle("Catalog · Keel", { timeout: STEP_MS });
        await textIs(page, "recipes.catalog.title", "Catalog");
        expect(await rows(page)).toHaveLength(5);
        await textIs(page, "recipes.table.status", "Page 1 of 2");
        await expect(byId(page, "recipes.table.previous")).toHaveCount(0);
        await byId(page, "recipes.table.next").click();
        await textIs(page, "recipes.table.status", "Page 2 of 2");
        await expect.poll(async () => (await rows(page)).length, { timeout: STEP_MS }).toBe(2);
        await expect(byId(page, "recipes.table.previous")).toHaveCount(1);
        expect(new URL(page.url()).searchParams.get("page")).toBe("2");
      } finally {
        await context.close();
      }
    },
  },
  {
    name: "catalog.sort-by-price",
    async run(env) {
      const { context, page } = await open(env);
      try {
        await page.goto(`${env.origin}/catalog`);
        await byId(page, "recipes.table.sort.price").click();
        await rowsAre(page, ["Filler 1", "Filler 2", "Filler 3", "Filler 4", "Filler 5"]);
        await byId(page, "recipes.table.sort.price").click();
        await rowsAre(page, ["Miso soup", "Pasta bake", "Filler 5", "Filler 4", "Filler 3"]);
        const q = new URL(page.url()).searchParams;
        expect([q.get("sort"), q.get("dir")]).toEqual(["price", "desc"]);
        await page.reload();
        await rowsAre(page, ["Miso soup", "Pasta bake", "Filler 5", "Filler 4", "Filler 3"]);
      } finally {
        await context.close();
      }
    },
  },
  {
    name: "catalog.sort-by-title-and-minutes",
    async run(env) {
      const { context, page } = await open(env);
      try {
        await page.goto(`${env.origin}/catalog`);
        await byId(page, "recipes.table.sort.title").click();
        await rowsAre(page, ["Filler 1", "Filler 2", "Filler 3", "Filler 4", "Filler 5"]);
        await byId(page, "recipes.table.sort.minutes").click();
        await rowsAre(page, ["Filler 1", "Filler 2", "Pasta bake", "Filler 3", "Filler 4"]);
        await byId(page, "recipes.table.sort.minutes").click();
        await rowsAre(page, ["Miso soup", "Filler 5", "Filler 4", "Filler 3", "Pasta bake"]);
      } finally {
        await context.close();
      }
    },
  },
  {
    name: "catalog.search",
    async run(env) {
      const { context, page } = await open(env);
      try {
        await page.goto(`${env.origin}/catalog`);
        await byId(page, "recipes.search.input").fill("FILLER 3");
        await rowsAre(page, ["Filler 3"]);
        await textIs(page, "recipes.table.status", "Page 1 of 1");
        expect(new URL(page.url()).searchParams.get("q")?.toLowerCase()).toBe("filler 3");
        await page.goto(`${env.origin}/catalog?q=soup`);
        await rowsAre(page, ["Miso soup"]);
      } finally {
        await context.close();
      }
    },
  },
  {
    name: "catalog.favorites-filter",
    async run(env) {
      const id = await idOf(env, PASTA.title);
      const { context, page } = await open(env);
      try {
        await page.goto(`${env.origin}/catalog`);
        await byId(page, "recipes.catalog.favorites").click();
        await rowsAre(page, [PASTA.title]);
        await textIs(page, `recipes.table.favorite.${id}`, "Yes");
        await byId(page, "recipes.catalog.all").click();
        await expect.poll(async () => (await rows(page)).length, { timeout: STEP_MS }).toBe(5);
      } finally {
        await context.close();
      }
    },
  },
  {
    name: "catalog.shopping-list",
    async run(env) {
      const a = await idOf(env, "Filler 1");
      const b = await idOf(env, "Filler 2");
      const { context, page } = await open(env);
      try {
        await page.goto(`${env.origin}/catalog?sort=title&dir=asc`);
        await byId(page, `recipes.table.select.${a}`).check();
        await byId(page, `recipes.table.select.${b}`).check();
        await byId(page, "recipes.addSelected").click();
        await openListTab(page);
        const items = byId(page, "recipes.shopping.items").locator("li");
        await expect
          .poll(async () => (await items.allTextContents()).map(norm).sort(), { timeout: STEP_MS })
          .toEqual(["Filler 1", "Filler 2"]);
        await byId(page, "recipes.clear.trigger").click();
        const dialog = byId(page, "recipes.clear.dialog");
        await expect(dialog).toBeVisible({ timeout: STEP_MS });
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden({ timeout: STEP_MS });
        await expect(items).toHaveCount(2);
        await byId(page, "recipes.clear.trigger").click();
        await byId(page, "recipes.clear.cancel").click();
        await expect(items).toHaveCount(2);
        await byId(page, "recipes.clear.trigger").click();
        await byId(page, "recipes.clear.confirm").click();
        await expect(byId(page, "recipes.shopping.empty")).toBeVisible({ timeout: STEP_MS });
      } finally {
        await context.close();
      }
    },
  },
  {
    name: "browser.no-page-errors",
    async run(env) {
      expect(env.pageErrors, "uncaught page errors").toEqual([]);
    },
  },
];

/** Runs every check against `origin` and returns the tally; a failed check never stops the next one. */
export async function runAcceptance(origin: string): Promise<Acceptance> {
  const browser = await chromium.launch();
  const env: Env = { origin: origin.replace(/\/$/, ""), browser, pageErrors: [] };
  const results: CheckResult[] = [];
  try {
    for (const check of CHECKS) {
      try {
        await check.run(env);
        results.push({ name: check.name, passed: true, reason: "" });
      } catch (e) {
        const reason = (e instanceof Error ? e.message : String(e)).split("\n").slice(0, 14).join(" ").slice(0, 900);
        results.push({ name: check.name, passed: false, reason });
      }
    }
  } finally {
    await browser.close();
  }
  return { passed: results.filter((r) => r.passed).length, total: results.length, results };
}
