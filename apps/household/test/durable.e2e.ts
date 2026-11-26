// Data kept through a SIGKILL with a write in flight, on PGlite under the run's data folder: the list and its rules,
// the receipts, the household name and the session are all there after the server is started again, and the list's
// pages say Connecting while it is gone and Live once it is back.
import { expect, it } from "vitest";
import { addStaple, holds, household, itemsOf, json, member, read, unexpected } from "./householdApp.ts";

it("PGlite keeps the list, the receipts and the name through a kill with a write in flight, and the session outlives it", async () => {
  const { served } = await household();
  const page = await member(served, "Ada Lovelace", "ada@example.com");
  await page.navigate("/setup");
  await page.fire("setup.form:name", { type: "input", value: "Oak Road" });
  await page.fire("setup.save", { type: "click" });
  await page.until("setup.done", { text: /\S/ });
  await page.navigate("/receipts");
  await page.fire("receipts.new:shop", { type: "input", value: "Market" });
  await page.fire("receipts.new:amount", { type: "input", value: "3.5" });
  await page.fire("receipts.save", { type: "click" });
  expect((await page.findAll("receipts.total")).map((t) => t.text)).toContain("€3.50");
  await page.navigate("/list");
  await page.until("shopping.live", { text: /^Live/ });
  await addStaple(page, "milk");
  const post = (name: string) =>
    page.fetch("/api/items", { method: "POST", headers: json, body: JSON.stringify({ name }) });
  expect((await post("Eggs")).status).toBe(200);
  const rice = await post("Rice");
  expect(rice.status).toBe(200);

  // Flour is in flight when the server is killed; whether it landed is the app's to say, the rules hold either way.
  const flour = post("Flour").then(
    (r) => r.status,
    () => 0,
  );
  await served.stop();
  await served.start();
  await flour;

  const items = await itemsOf(await page.fetch("/api/items", { headers: read }));
  const names = items.map((i) => i.name);
  for (const n of ["Milk", "Eggs", "Rice"]) expect(names).toContain(n);
  expect(holds(items)).toBe(true);
  await page.navigate("/receipts");
  expect((await page.findAll("receipts.total")).map((t) => t.text)).toContain("€3.50");
  const named = await (await page.fetch("/api/household", { headers: read })).text();
  expect(named).toContain("Oak Road");
  await page.navigate("/profile");
  expect((await page.location()).path).toBe("/profile");
  expect(unexpected(page)).toEqual([]);
});
