// Two members with the list open say Connecting while the server is gone and Live once it is back, and the next add of
// one reaches the other's page with no reload.
import { fixedTime } from "@keel/tooling/test-time";
import { expect, it } from "vitest";
import { addStaple, household, idOf, member, rows, unexpected } from "./householdApp.ts";

it(
  "two pages say Connecting while the server is gone and Live once it is back, and the next add reaches the other page with no reload",
  // The app's own time: the change stream's reconnect after the server is back (up to 45 s).
  { timeout: fixedTime(150_000) },
  async () => {
    const { served } = await household();
    const ada = await member(served, "Ada Lovelace", "ada@example.com");
    const grace = await member(served, "Grace Hopper", "grace@example.com");
    const loads = (await grace.documents()).length;

    await served.stop();
    await ada.until("shopping.live", { text: /^Connecting/ }, { fixed: 15_000 });
    await grace.until("shopping.live", { text: /^Connecting/ }, { fixed: 15_000 });
    await served.start();
    await ada.until("shopping.live", { text: /^Live/ }, { fixed: 45_000 });
    await grace.until("shopping.live", { text: /^Live/ }, { fixed: 45_000 });

    await addStaple(ada, "apples");
    const apples = await idOf(ada, "Apples");
    await grace.until(`shopping.name.${apples}`, { text: /^Apples/ });
    expect(await rows(grace)).toContain("Apples × 1");
    expect((await grace.documents()).length).toBe(loads);
    expect(unexpected(ada)).toEqual([]);
    expect(unexpected(grace)).toEqual([]);
  },
);
