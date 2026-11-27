// The same kill and restart on Postgres 17: the app serves, a member signs in and the writes land, and after a SIGKILL
// and a start again the list and the receipts are still there. The database is the one `KEEL_TEST_POSTGRES_URL` names.
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { environment, household, itemsOf, json, member, read } from "./householdApp.ts";

it("Postgres 17 serves the app, signs in and takes writes, and keeps the list and the receipts through a SIGKILL and restart", async () => {
  const url = process.env.KEEL_TEST_POSTGRES_URL;
  if (url === undefined || url === "")
    throw new Error("KEEL_TEST_POSTGRES_URL is not set: this case needs a Postgres 17 database to run against");
  const { served } = await household(() => ({
    ...environment(""),
    KEEL_POSTGRES_URL: url,
  }));
  // The database outlives a run: this member and her tea are the run's own.
  const tag = randomUUID().slice(0, 8);
  const page = await member(served, "Sam Smoke", `sam-${tag}@example.com`);
  await page.navigate("/setup");
  await page.fire("setup.form:name", { type: "input", value: "Birch Lane" });
  await page.fire("setup.save", { type: "click" });
  await page.until("setup.done", { text: /\S/ });
  const tea = `Tea ${tag}`;
  const added = await page.fetch("/api/items", { method: "POST", headers: json, body: JSON.stringify({ name: tea }) });
  expect(added.status).toBe(200);
  await page.navigate("/receipts");
  await page.fire("receipts.new:shop", { type: "input", value: "Bakery" });
  await page.fire("receipts.new:amount", { type: "input", value: "4.20" });
  await page.fire("receipts.save", { type: "click" });
  expect((await page.findAll("receipts.total")).map((t) => t.text)).toContain("€4.20");

  await served.stop();
  await served.start();
  const items = await itemsOf(await page.fetch("/api/items", { headers: read }));
  expect(items.map((i) => i.name)).toContain(tea);
  await page.navigate("/receipts");
  expect((await page.findAll("receipts.total")).map((t) => t.text)).toContain("€4.20");
});
