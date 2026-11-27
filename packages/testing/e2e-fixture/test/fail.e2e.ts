// The failing cases of @keel/testing's own e2e run (test/e2eRun.test.ts): what a failure prints and writes.
import { serve } from "@keel/testing/e2e";
import { it } from "vitest";

it("an until that runs out", async () => {
  const app = await serve();
  const page = await app.open("/status");
  const waiting = page.until("a.status", { text: "Live" }, { within: 1000 });
  await app.fetch("/");
  await waiting;
});

it("an until that runs out with two tabs", async () => {
  const app = await serve();
  const first = await app.open("/status");
  await first.open("/status");
  await first.until("a.status", { text: "Live" }, { within: 1000 });
});

it("a boom the test never reads", async () => {
  const app = await serve();
  const page = await app.open("/boom");
  await page.fire("a.boom.go", { type: "click" });
});
