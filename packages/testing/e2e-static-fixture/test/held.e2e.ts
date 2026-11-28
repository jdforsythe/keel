import { serve } from "@keel/testing/e2e";
import { expect, it } from "vitest";

it("a held static document with a scheme script is parsed and resumes in place", async () => {
  const served = await serve();
  try {
    const page = await served.open("/", { hold: true });
    expect((await page.find("s.page.text")).text).toBe("Held");
    await page.resume();
    expect((await page.find("s.page.more")).text).toBe("More");
  } finally {
    await served.dispose();
  }
});
