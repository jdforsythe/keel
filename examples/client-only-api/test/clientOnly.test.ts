import { createCtx } from "@keel/ctx";
import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import { app } from "../modules/app/app.contract.ts";
import { routes } from "../modules/app/routes.ts";

const RELEASES = "https://api.github.com/repos/nodejs/node/releases?per_page=5";
const TWO = [
  { tag_name: "v25.1.0", name: "2026-11-04, Version 25.1.0 (Current)", published_at: "2026-11-04T12:00:00Z" },
  { tag_name: "v24.9.0", name: null, published_at: null },
];

/** A sim ctx whose net answers GitHub's releases with `answer`; any other URL is unrouted (a 404 the log shows). */
function world(answer: () => Response | Promise<Response>) {
  const ctx = createCtx({ mode: "sim", seed: 1 });
  ctx.net.route("https://api.github.com/*", answer);
  return { ctx };
}

const GITHUB = { method: "GET", url: RELEASES, headers: ["accept"] };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

it("renders the home page and navigates to the releases with no server, asking only GitHub", async () => {
  const { ctx } = world(() => json(TWO));
  const page = await renderRoute("app.home", { routes, params: {}, ctx });
  expect(page.find("app.home.title").text).toBe("A site with no server");
  // A keyboard user meets the masthead's page links first, then the link in the text, as they read.
  expect(page.focusOrder()).toEqual(["app.nav.home", "app.nav.releases", "app.home.toReleases"]);
  expect(page.find("app.home.toReleases")).toMatchObject({ role: "link", name: "See the latest Node.js releases" });
  expect(page.requests()).toEqual([]);
  await page.navigate(app.href("app.releases"));
  await page.settle();
  expect(page.route().id).toBe("app.releases");
  expect(page.a11y("app.releases.title")).toMatchObject({ role: "heading", name: "Latest Node.js releases" });
  expect(page.find("app.releases.list").role).toBe("list");
  expect(page.find("app.releases.list").text).toContain("v25.1.0");
  expect(page.find("app.releases.list").text).toContain("v24.9.0");
  await page.navigate(app.href("app.home"));
  expect(page.find("app.home.title").text).toBe("A site with no server");
  // The one request is GitHub's: no `/__keel/user` read, so the app has not opted into identity.
  expect(page.requests()).toEqual([GITHUB]);
  page.dispose();
});

it("sends GitHub a CORS-simple GET: `accept` alone, no Keel header, no cookie", async () => {
  const { ctx } = world(() => json(TWO));
  const page = await renderRoute("app.releases", { routes, params: {}, ctx });
  await page.settle();
  expect(page.find("app.releases.list").text).toContain("v25.1.0");
  expect(page.requests()).toEqual([GITHUB]);
  page.dispose();
});

it("asks GitHub again on a reload of the releases page, and nothing else", async () => {
  const { ctx } = world(() => json(TWO));
  for (const _ of [1, 2]) {
    const page = await renderRoute("app.releases", { routes, params: {}, ctx });
    await page.settle();
    expect(page.find("app.releases.list").text).toContain("v25.1.0");
    expect(page.requests()).toEqual([GITHUB]);
    page.dispose();
  }
});

it("shows the loading line until GitHub answers", async () => {
  const { ctx } = world(async () => {
    await ctx.clock.after(1000);
    return json(TWO);
  });
  const page = await renderRoute("app.releases", { routes, params: {}, ctx });
  expect(page.find("app.releases.loading").role).toBe("status");
  ctx.clock.advance(1000);
  await page.settle();
  expect(page.find("app.releases.list").text).toContain("v25.1.0");
  page.dispose();
});

it("says so when GitHub lists no releases", async () => {
  const { ctx } = world(() => json([]));
  const page = await renderRoute("app.releases", { routes, params: {}, ctx });
  await page.settle();
  expect(page.find("app.releases.empty").text).toBe("No releases yet.");
  page.dispose();
});

it("shows an alert when GitHub fails or sends another shape", async () => {
  for (const answer of [() => json({ message: "rate limited" }, 403), () => json({ releases: [] })]) {
    const { ctx } = world(answer);
    const page = await renderRoute("app.releases", { routes, params: {}, ctx });
    await page.settle();
    expect(page.find("app.releases.error").role).toBe("alert");
    page.dispose();
  }
});
