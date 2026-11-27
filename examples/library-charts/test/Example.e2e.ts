import { serve } from "@keel/testing/e2e";
import { expect, it } from "vitest";

it("shows its text at <id>.text, passes axe and takes a box", async () => {
  const app = await serve({ page: "src/Example.tsx", props: { id: "lib" } });
  const page = await app.open("/");
  expect((await page.find("lib.text")).text).toBe("Example");
  await page.a11y();
  expect((await page.layout("lib.text")).width).toBeGreaterThan(0);
});
