// Dev mode of golden-2: `keel dev` (`AUTH_FIXTURE=dev` and `KEEL_POSTGRES_URL=pglite:.keel-dev/postgres`, as the app's
// `dev` script sets them) in a copy of the app in a temporary folder, so its `.keel-dev/` state is that folder's. `/`
// and `/catalog` answer the page shell that loads `/@keel/entry.ts`; the sign-in page is server-rendered by the `api`
// deployable; the shell and the sign-in page each link a stylesheet that answers 200 as CSS with the brand font faces
// and a rule for every `k-*` class the page uses; a sign-up and a sign-in post to the identity mount (`/api/auth`) the
// way the account forms do and answer 303 to the sign-in page, the sign-in with a session cookie; with that cookie the
// sign-in page names the account and `GET /api/me` answers its email, and without it neither does; a recipe posted with
// that cookie is in `GET /api/recipes` and the app's database is a PGlite folder under `.keel-dev/postgres`; every
// server-only file the accounts routes import is served to a browser request as its stub, with no `node:` import and
// none of the file's code; `/__keel/inspect` holds the `api` deployable's inspector section `kitchen.box.currency` as a
// tally and `keel report` prints it; after an edit to the server file that registers that section, `/api/*` still
// answers 200 and the section is still served; after each of two edits to the file declaring the kitchen's database,
// the edited declaration runs, `/api/recipes` answers 200 with the recipe posted before, and no E1602 is logged;
// likewise once the declaration moves into a helper module the declaring file calls, after an edit to the declaring
// file (twice) and to the helper.
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { appendFile, cp, rm, symlink, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { type Served, serve } from "@keel/testing/e2e";
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, beforeAll, expect, it } from "vitest";

const app = resolve(import.meta.dirname, "..");
const cli = resolve(app, "..", "..", "packages", "cli", "src", "bin.ts");
const skipped = new Set(["node_modules", "dist", ".keel", ".keel-dev", ".turbo", "reports", ".api.storage", "test"]);
let tmp = "";
let dir = "";

beforeAll(async () => {
  tmp = tempDir("keel-e2e-dev-");
  dir = join(tmp, "app");
  await cp(app, dir, { recursive: true, filter: (src) => src === app || !skipped.has(basename(src)) });
  await symlink(join(app, "node_modules"), join(dir, "node_modules"), "dir");
});

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
});

const html = { accept: "text/html" };
const asJson = { accept: "application/json" };
const script = { accept: "*/*", "sec-fetch-dest": "script" };

/** The text of `path` with `headers`, and its status. */
async function text(served: Served, path: string, headers: Record<string, string> = html) {
  const res = await served.fetch(path, { headers });
  return { status: res.status, body: await res.text(), res };
}

/** The section `kitchen.box.currency` of the dev inspect document, and whether its value has a tally's shape. */
async function currencySection(served: Served) {
  const doc = await text(served, "/__keel/inspect", asJson);
  let value: unknown;
  try {
    const sections: unknown = JSON.parse(doc.body).sections;
    value =
      typeof sections === "object" && sections !== null
        ? Reflect.get(sections, "kitchen.box.currency")?.value
        : undefined;
  } catch {
    // Not JSON: no section.
  }
  const rows = typeof value === "object" && value !== null ? Reflect.get(value, "rows") : undefined;
  const tally =
    typeof value === "object" &&
    value !== null &&
    Reflect.get(value, "kind") === "report.tally" &&
    Reflect.get(value, "id") === "kitchen.box.currency" &&
    Array.isArray(rows) &&
    rows.every((r: unknown) => typeof r === "object" && r !== null && typeof Reflect.get(r, "key") === "string");
  return { status: doc.status, tally };
}

/** `keel report <origin>` run in `cwd`: its exit code and output. */
const report = (cwd: string, origin: string) =>
  new Promise<{ code: number; out: string }>((done) => {
    execFile(
      process.execPath,
      ["--disable-warning=ExperimentalWarning", cli, "report", origin],
      { cwd, env: { ...process.env, KEEL_AGENT: "1", KEEL_E2E: "", KEEL_TEST: "" }, timeout: fixedTime(30_000) },
      (err, stdout, stderr) => done({ code: err === null ? 0 : Number(err.code ?? 1), out: `${stdout}${stderr}` }),
    );
  });

/** The text of every record the dev server wrote, one per line. */
const logLines = (served: Served): string[] =>
  served.serverLog().map((r) => (r.kind === "other" ? r.text : JSON.stringify(r)));

/**
 * Write the edit through `write` and ask `path` until `done()`: the dev server loads the edited code while answering.
 * The test reads no clock (E1601), so the loop is bounded by its requests: `write` runs again every 40 of them (the
 * watcher sometimes reports no change for a file created moments ago), and the loop ends after 1500.
 */
async function edited(served: Served, write: () => Promise<void>, done: () => boolean, path = "/api/recipes") {
  await write();
  for (let n = 1; n <= 1500; n++) {
    await served.fetch(path, { headers: asJson });
    if (done()) return true;
    if (n % 40 === 0) await write();
  }
  return done();
}

it(
  "keel dev serves the shells, styles, stubs and inspect document, signs in, and reloads edits to server files",
  { timeout: fixedTime(300_000) }, // `keel dev` starts cold, and on a loaded machine each reload of the database declaration takes ten seconds or more
  async () => {
    const served = await serve({
      project: dir,
      dev: true,
      env: { AUTH_FIXTURE: "dev", KEEL_POSTGRES_URL: "pglite:.keel-dev/postgres" },
    });
    const origin = served.origin();

    // The shell: `/` and `/catalog` are the page that loads the client entry.
    for (const path of ["/", "/catalog"]) {
      const page = await text(served, path);
      expect(page.status, path).toBe(200);
      expect(page.body, path).toContain('<div id="app">');
      expect(page.body, path).toContain('src="/@keel/entry.ts"');
    }
    const signinPage = await text(served, "/account/signin");
    expect(signinPage.status).toBe(200);
    expect(signinPage.body).toContain('id="accounts.signin"');
    expect(signinPage.body).not.toContain('id="accounts.signedIn"');

    // Dev documents link the styles a built one does (k.head Server): the `client` shell and the `api` document each
    // link a stylesheet that answers 200 as CSS with the brand font faces, and the server-rendered page's `k-*` rules.
    for (const [path, page] of [
      ["/", await text(served, "/")],
      ["/account/signin", signinPage],
    ] as const) {
      const hrefs = [...page.body.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) =>
        (m[1] ?? "").replaceAll("&amp;", "&"),
      );
      const sheets = await Promise.all(hrefs.map((h) => text(served, h, { accept: "text/css,*/*;q=0.1" })));
      const css = sheets.map((x) => x.body).join("\n");
      const classes = [
        ...new Set([...page.body.matchAll(/class="([^"]*)"/g)].flatMap((m) => (m[1] ?? "").split(/\s+/))),
      ].filter((c) => c.startsWith("k-"));
      const missing = classes.filter((c) => !css.includes(`.${c.replaceAll(":", "\\:")}`));
      expect(hrefs.length, `${path} stylesheets`).toBeGreaterThan(0);
      for (const x of sheets) {
        expect(x.status, path).toBe(200);
        expect(x.res.headers.get("content-type") ?? "", path).toMatch(/^text\/css/);
      }
      expect(css, path).toContain("@font-face");
      expect(missing, `${path} classes without a rule`).toEqual([]);
    }
    expect((await text(served, "/api/me", asJson)).status).toBe(403);

    // Sign up and sign in through the identity mount, as the forms post: the page's context keeps the session cookie.
    const page = await served.open("/account/signin");
    const email = `cook-${process.pid}@example.com`;
    const password = "dev password";
    const mount = async (path: string, fields: Record<string, string>) => {
      const res = await page.fetch(`/api/auth${path}`, {
        method: "POST",
        headers: { ...html, "content-type": "application/x-www-form-urlencoded", origin },
        body: new URLSearchParams(fields).toString(),
      });
      return { status: res.status, location: res.headers.get("location") ?? "", cookies: res.headers.getSetCookie() };
    };
    const up = await mount("/sign-up/email", { name: "Dev Cook", email, password });
    expect([up.status, up.location]).toEqual([303, "/account/signin"]);
    const inn = await mount("/sign-in/email", { email, password });
    expect([inn.status, inn.location]).toEqual([303, "/account/signin"]);
    expect(inn.cookies.some((c) => c.startsWith("better-auth.session_token="))).toBe(true);
    expect((await page.cookies()).map((c) => c.name)).toContain("better-auth.session_token");
    const bad = await mount("/sign-in/email", { email, password: "wrong password" });
    expect(bad.status).toBe(303);
    expect(bad.cookies).toEqual([]);

    // With the session the next requests see the account.
    const named = await page.fetch("/account/signin", { headers: html });
    expect(named.status).toBe(200);
    const namedBody = await named.text();
    expect(namedBody).toContain('id="accounts.signedIn"');
    expect(namedBody).toContain(email);
    const me = await page.fetch("/api/me", { headers: asJson });
    expect(me.status).toBe(200);
    expect(await me.text()).toContain(email);

    // The browser's module requests: a server-only file the client graph imports is its stub.
    const routes = await text(served, "/modules/accounts/routes.ts", script);
    const files = [...routes.body.matchAll(/from "(\/modules\/[^"]*\.server\.ts)"/g)].map((m) => m[1] ?? "");
    expect(routes.status).toBe(200);
    expect(files.length).toBeGreaterThan(0);
    for (const file of [...files, "/modules/accounts/authOf.server.ts"]) {
      const mod = await text(served, file, script);
      expect(mod.status, file).toBe(200);
      expect(mod.body, file).toContain("serverOnly(");
      expect(mod.body, file).not.toContain("node:");
    }

    // The inspect document holds the `api` deployable's inspector sections, and `keel report` prints its tally.
    const posted = await page.fetch("/api/recipes", {
      method: "POST",
      headers: { ...asJson, "content-type": "application/json", "x-keel": "1" },
      body: JSON.stringify({ title: "Smoke stew", minutes: 40, price: { amount: 900, currency: "EUR" } }),
    });
    expect(posted.status).toBe(200);
    const recipes = await page.fetch("/api/recipes", { headers: asJson });
    expect(recipes.status).toBe(200);
    expect(await recipes.text()).toContain('"title":"Smoke stew"');
    expect(existsSync(join(dir, ".keel-dev", "postgres", "PG_VERSION"))).toBe(true);
    const section = await currencySection(served);
    expect([section.status, section.tally]).toEqual([200, true]);
    const printed = await report(dir, origin);
    expect(printed.code, printed.out).toBe(0);
    expect(printed.out).toContain("ok report 1 tallies");

    // An edit to the server file that registers the section at its top level: the dev apps load again and still answer.
    const reloaded = (file: string) => logLines(served).some((l) => l.includes("page reload") && l.includes(file));
    const registers = "modules/kitchen/currencyTally.server.ts";
    expect(
      await edited(
        served,
        () => appendFile(join(dir, registers), "\n// edited while serving\n"),
        () => reloaded(registers),
      ),
    ).toBe(true);
    for (const path of ["/api/recipes", "/api/me"])
      expect((await page.fetch(path, { headers: asJson })).status, path).toBe(200);
    const again = await currencySection(served);
    expect([again.status, again.tally]).toEqual([200, true]);

    // An edit to the file that declares the kitchen's database, twice: the next requests run the edited declaration (it
    // prints its mark), answer 200 with the recipe posted before, so the reload reused the database, and no E1602.
    const declarer = "modules/kitchen/kitchenDb.server.ts";
    const marked = (mark: string) => logLines(served).some((l) => l.includes(mark));
    const stewAfter = async () => {
      const res = await page.fetch("/api/recipes", { headers: asJson });
      return { status: res.status, body: await res.text() };
    };
    for (const n of [1, 2]) {
      const mark = `keel e2e: kitchen.db declared again ${n}`;
      const ran = await edited(
        served,
        () => appendFile(join(dir, declarer), `\nconsole.warn(${JSON.stringify(mark)});\n`),
        () => marked(mark),
      );
      const after = await stewAfter();
      expect(ran, `edit ${n}: the edited declaration ran`).toBe(true);
      expect(after.status).toBe(200);
      expect(after.body).toContain('"title":"Smoke stew"');
    }
    // The declaration moved into a helper module the declaring file calls, then the declaring file and the helper each
    // edited: the file no longer names `database`, and its reload still loads the server graph again whole.
    const helper = "modules/kitchen/declareKitchen.server.ts";
    await writeFile(
      join(dir, helper),
      'import { database } from "@keel/std-postgres/server";\n\nexport function declareKitchen() {\n  return database("kitchen.db");\n}\n',
    );
    await edited(
      served,
      () =>
        writeFile(
          join(dir, declarer),
          'import { declareKitchen } from "./declareKitchen.server.ts";\n\nexport const kitchenDb = declareKitchen();\n',
        ),
      () => reloaded(declarer),
    );
    expect((await stewAfter()).status).toBe(200);
    for (const [n, file] of [
      [3, declarer],
      [4, declarer],
      [5, helper],
    ] as const) {
      const mark = `keel e2e: kitchen.db declared through a helper ${n}`;
      const ran = await edited(
        served,
        () => appendFile(join(dir, file), `\nconsole.warn(${JSON.stringify(mark)});\n`),
        () => marked(mark),
      );
      const after = await stewAfter();
      expect(ran, `edit ${n} (${file.split("/").at(-1)}): the edited file ran`).toBe(true);
      expect(after.status).toBe(200);
      expect(after.body).toContain('"title":"Smoke stew"');
    }
    expect(logLines(served).find((l) => l.includes("already registered"))).toBeUndefined();
  },
);
