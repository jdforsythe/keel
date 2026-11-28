// The built `web` sends the `Host` node empty and, in Chromium under the document's policy, the library's code draws
// into it: the element takes the box the drawn SVG gives it. No page or console error
// is raised (an unread one fails the test).
import { serve } from "@keel/testing/e2e";
import { expect, it } from "vitest";

it("the server sends the Host node empty and the page's code draws the bars into it", async () => {
  const app = await serve();
  const doc = await app.fetch("/", { headers: { accept: "text/html" } });
  const html = await doc.text();
  expect(doc.status).toBe(200);
  expect(html).toMatch(/<div [^>]*id="app\.home\.chart"[^>]*><\/div>/);
  expect(html).toContain("data-k-host");

  const page = await app.open("/");
  const chart = await page.find("app.home.chart");
  expect(chart.role).toBe("img");
  // The drawn SVG is 200 px high; the element the server sent empty has none.
  expect((await page.layout("app.home.chart")).height).toBeGreaterThanOrEqual(200);
});
