import { run } from "@keel/cli";
import { createApp } from "@keel/server";
import { Tally, tallyOf } from "@keel/std-report";
import "@keel/std-report/tools";
import { describe, expect, it } from "vitest";
import topology from "../topology.ts";
import { apiRoutes } from "./apiRoutes.ts";
import { apiCtx, asJson, asUser, draft } from "./simApi.ts";

const ID = "kitchen.box.currency";

/** The `kitchen.box.currency` section of the dev inspect document `app` serves. */
const section = async (app: { fetch: (req: Request) => Response | Promise<Response> }): Promise<unknown> => {
  const body: unknown = await (await app.fetch(new Request("http://localhost/__keel/inspect"))).json();
  const sections = typeof body === "object" && body !== null && "sections" in body ? body.sections : null;
  const found = typeof sections === "object" && sections !== null && ID in sections ? sections[ID] : null;
  return typeof found === "object" && found !== null && "value" in found ? found.value : null;
};

const devApi = () =>
  createApp({ topology, routes: apiRoutes, ctx: apiCtx(), deployable: "api", mode: "dev", identity: asUser("tester") });

describe("the kitchen's tally of the box by currency", () => {
  it("is an empty tally in the dev inspect document before any request reads the box", async () => {
    expect(Tally.parse(await section(await devApi()))).toEqual({ ok: true, value: tallyOf(ID, []) });
  });

  it("counts the recipes by price currency, most first, as of the last read of the box or the catalog", async () => {
    const app = await devApi();
    await app.fetch(asJson("POST", "/api/recipes", draft("Soup", 30, 1250, "EUR")));
    await app.fetch(asJson("POST", "/api/recipes", draft("Ramen", 25, 900, "JPY")));
    await app.fetch(asJson("POST", "/api/recipes", draft("Stew", 90, 1500, "EUR")));
    expect(Tally.parse(await section(app))).toEqual({ ok: true, value: tallyOf(ID, []) });
    await app.fetch(asJson("GET", "/api/recipes"));
    expect(await section(app)).toEqual({
      kind: "report.tally",
      id: ID,
      rows: [
        { key: "EUR", n: 2 },
        { key: "JPY", n: 1 },
      ],
    });
    await app.fetch(asJson("POST", "/api/recipes", draft("Chili", 60, 800, "USD")));
    await app.fetch(asJson("GET", "/api/catalog/en-US?currency=EUR"));
    expect(Tally.parse(await section(app))).toEqual({ ok: true, value: tallyOf(ID, ["EUR", "JPY", "EUR", "USD"]) });
  });

  it("keeps one tally per server: another api's box does not show in this one's section", async () => {
    const one = await devApi();
    const other = await devApi();
    await one.fetch(asJson("POST", "/api/recipes", draft("Soup", 30)));
    await one.fetch(asJson("GET", "/api/recipes"));
    expect(Tally.parse(await section(other))).toEqual({ ok: true, value: tallyOf(ID, []) });
    expect(Tally.parse(await section(one))).toEqual({ ok: true, value: tallyOf(ID, ["EUR"]) });
  });

  it("is printed by keel report against the dev api as one line, then the count of tallies", async () => {
    const app = await devApi();
    await app.fetch(asJson("POST", "/api/recipes", draft("Soup", 30, 1250, "EUR")));
    await app.fetch(asJson("POST", "/api/recipes", draft("Ramen", 25, 900, "JPY")));
    await app.fetch(asJson("POST", "/api/recipes", draft("Stew", 90, 1500, "EUR")));
    await app.fetch(asJson("GET", "/api/recipes"));
    const r = await run(["report", "http://localhost", "--format=compact"], {
      cwd: process.cwd(),
      files: [],
      fetch: (url) => Promise.resolve(app.fetch(new Request(url))),
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("kitchen.box.currency EUR=2 JPY=1\nok report 1 tallies\n");
  });
});
