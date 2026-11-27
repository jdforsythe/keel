// The built page holds the library's `Host` element empty; in Chromium, under the document's policy, the library's code
// draws into it: the element takes the box the drawn SVG gives it. No page or console error is raised (an unread one
// fails the test).
import { serve } from "@keel/testing/e2e";
import { expect, it } from "vitest";

it("the built page holds the library's Host element empty and the library's code draws into it", async () => {
  const app = await serve();
  const doc = await app.fetch("/", { headers: { accept: "text/html" } });
  expect(doc.status).toBe(200);
  expect(await doc.text()).toMatch(/<div [^>]*id="app\.rain\.chart"[^>]*><\/div>/);

  const page = await app.open("/");
  expect((await page.find("app.rain.chart")).role).toBe("img");
  expect((await page.layout("app.rain.chart")).height).toBeGreaterThan(0);
});
