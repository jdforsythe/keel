// @vitest-environment happy-dom
// Rule E1554: loader data fails its output schema (dev diagnostic; 500 in production).
// ASSUMPTION: in dev the diagnostic code appears in the response body; the production body does not carry it.
import { ok } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { build, get } from "./fixtures.ts";

const bad = () => Promise.resolve(ok({ title: 42 }));

describe("k.server", () => {
  it("E1554 loader data failing its output schema is reported in dev and yields 500", async () => {
    const { app } = await build({ show: bad }, "dev");
    const res = await app.fetch(get("/orders/open"));
    expect(res.status).toBe(500);
    expect(await res.text()).toContain("E1554");
  });

  it("E1554 in production yields 500", async () => {
    const { app } = await build({ show: bad }, "production");
    expect((await app.fetch(get("/orders/open"))).status).toBe(500);
  });

  it("E1554 clean counterpart: valid loader data yields 200", async () => {
    const { app } = await build({}, "dev");
    expect((await app.fetch(get("/orders/open"))).status).toBe(200);
  });
});
