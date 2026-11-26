// The Tauri files register the shell's id; the web build as a plain client host shows the page and calls no Keel server:
// no request goes to `/__keel/*` and no page or console error is raised.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { serve } from "@keel/testing/e2e";
import { expect, it } from "vitest";

it("the shell carries the app's id and the web build shows its page with no Keel request", async () => {
  const conf = await readFile(join(import.meta.dirname, "..", "deploy", "web", "tauri", "tauri.conf.json"), "utf8");
  expect(conf).toContain('"schemes": ["dev.keel.nativetauri"]');

  const app = await serve();
  const page = await app.open("/");
  expect((await page.find("app.home.title")).text).toBe("One page in a Tauri shell");
  expect(page.requests().filter((r) => new URL(r.url).pathname.startsWith("/__keel/"))).toEqual([]);
  expect(page.problems()).toEqual([]);
});
