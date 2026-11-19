// GET /api/tally/currency answers the loader envelope holding the box's tally by currency. What `keel report` makes of
// such an answer is covered in `@keel/std-report`.
import { describe, expect, it } from "vitest";
import { apiApp, apiCtx, asJson, draft } from "./simApi.ts";

const ID = "kitchen.tally.currency";
const get = async (app: { fetch: (req: Request) => Response | Promise<Response> }): Promise<unknown> => {
  const res = await app.fetch(asJson("GET", "/api/tally/currency"));
  expect(res.status).toBe(200);
  return res.json();
};
const answer = (rows: { key: string; n: number }[]) => ({
  id: ID,
  results: { [ID]: { ok: true, value: { kind: "report.tally", id: "kitchen.box.currency", rows } } },
});

describe("GET /api/tally/currency", () => {
  it("answers the loader envelope holding an empty tally for an empty box", async () => {
    expect(await get(await apiApp(apiCtx()))).toEqual(answer([]));
  });

  it("answers the box's recipes counted by price currency, most first then by code, with no sign-in", async () => {
    const app = await apiApp(apiCtx());
    await app.fetch(asJson("POST", "/api/recipes", draft("Soup", 30, 1250, "EUR")));
    await app.fetch(asJson("POST", "/api/recipes", draft("Ramen", 25, 900, "JPY")));
    await app.fetch(asJson("POST", "/api/recipes", draft("Stew", 90, 1500, "EUR")));
    await app.fetch(asJson("POST", "/api/recipes", draft("Chili", 60, 800, "USD")));
    expect(await get(app)).toEqual(
      answer([
        { key: "EUR", n: 2 },
        { key: "JPY", n: 1 },
        { key: "USD", n: 1 },
      ]),
    );
  });

  it("counts the box as it is at each request", async () => {
    const app = await apiApp(apiCtx());
    await app.fetch(asJson("POST", "/api/recipes", draft("Soup", 30, 1250, "EUR")));
    expect(await get(app)).toEqual(answer([{ key: "EUR", n: 1 }]));
    await app.fetch(asJson("POST", "/api/recipes", draft("Stew", 90, 1500, "EUR")));
    expect(await get(app)).toEqual(answer([{ key: "EUR", n: 2 }]));
  });
});
