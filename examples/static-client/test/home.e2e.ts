// A plain file host sends `dist/web` with its `csp.txt` as the policy; Chromium renders the page, with no errors (an
// unread page or console error fails the test).
import { serve } from "@keel/testing/e2e";
import { expect, it } from "vitest";

it("the built files, sent by a plain host under their policy, render the page", async () => {
  const app = await serve();
  const page = await app.open("/");
  expect((await page.find("app.home.title")).text).toBe("Static files only");
  expect(page.problems()).toEqual([]);
});
