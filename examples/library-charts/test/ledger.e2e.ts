// The library's packed ledger holds its one `Host` element, no `unsafe` and the exports of its `src/` files; the chart
// it draws in a browser is proved by library-app's built page.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, it } from "vitest";

it("the packed ledger holds one Host element, no unsafe and the library's exports", async () => {
  const ledger: unknown = JSON.parse(await readFile(join(import.meta.dirname, "..", ".keel", "ledger.json"), "utf8"));
  const exported = Reflect.get(Object(ledger), "exports");
  const names = Array.isArray(exported) ? exported.map((e: unknown) => Reflect.get(Object(e), "name")) : [];
  expect(Reflect.get(Object(ledger), "hostElements")).toBe(1);
  expect(Reflect.get(Object(ledger), "unsafe")).toBe(0);
  expect(names).toContain("BarChart");
});
